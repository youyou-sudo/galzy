/**
 * 写操作成功后的用户视图缓存失效（按路由前缀映射）。
 *
 * 用户视图（首页 / 游戏 / 标签 / 合集 / 厂商 / 论坛 / 友链…）现在是
 * **ISR + CDN 两层缓存**：不失效的话，改完数据最长要等 revalidate 秒才可见。
 * 与其在每个 service 的每个写方法里手写清理，这里在 API 层统一按路由前缀
 * 做「写完就失效」——新增写接口时只要路径落在映射里就自动生效。
 *
 * 只对 2xx 的 POST/PUT/PATCH/DELETE 触发；失效请求异步发出，不阻塞响应。
 * 具体清理动作见 `libs/cloudflare-cache.ts`（Redis 频道 → web 删 ISR 页面 → API 清 CDN）。
 */
import {
  purgeCollectionPages,
  purgeFriendLinksPage,
  purgeHomePage,
  purgeTopicPages,
} from './cloudflare-cache'
import { publishIsrInvalidation } from './redis/pubsub'

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** 从 /collections/12/entries 这类路径里取第一段数字 id。 */
function idFromPath(path: string, prefix: string): string | undefined {
  const rest = path.slice(prefix.length).replace(/^\/+/, '')
  if (!rest) return undefined
  const first = rest.split('/')[0]
  return /^\d+$/.test(first) ? first : undefined
}

export function isMutatingRequest(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase())
}

/**
 * 是否启用写后失效：与 web 通过 Redis 频道通信，所以只看 REDIS_URL。
 * 未配置时直接跳过（本地没有 Redis 时保持静默）。
 */
function invalidationEnabled(): boolean {
  return Boolean(process.env.REDIS_URL)
}

/** 写操作成功后的失效（按路径分流）。 */
export async function invalidateAfterMutation(path: string): Promise<void> {
  if (!invalidationEnabled()) return
  try {
    if (path === '/collections' || path.startsWith('/collections/')) {
      const id = idFromPath(path, '/collections')
      if (id) {
        await purgeCollectionPages(id)
      } else {
        await publishIsrInvalidation({
          tags: ['page-collections', 'page-home'],
        })
      }
      return
    }

    if (path === '/topics' || path.startsWith('/topics/')) {
      const id = idFromPath(path, '/topics')
      await purgeTopicPages(id)
      return
    }

    if (path === '/friend-links' || path.startsWith('/friend-links/')) {
      await purgeFriendLinksPage()
      return
    }

    if (path === '/strategy' || path.startsWith('/strategy/')) {
      // 攻略文章挂在游戏详情页签下：失效游戏页签与首页
      // （具体游戏/文章路径未知时按标签清理，标签覆盖已缓存的页面变体）
      await publishIsrInvalidation({ tags: ['page-games', 'page-home'] })
      return
    }

    if (path === '/adverts' || path.startsWith('/adverts/')) {
      // 广告位/素材影响所有公共页面的顶部广告：首页立即失效，
      // 其他页面靠 ISR 的较短 revalidate 窗口自愈
      await purgeHomePage()
      return
    }
  } catch (error) {
    console.error('[isr-invalidation] 写后失效失败:', error)
  }
}
