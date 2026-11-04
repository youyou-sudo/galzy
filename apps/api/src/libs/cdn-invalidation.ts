/**
 * 写操作成功后的 CDN 失效（按路由前缀映射）。
 *
 * 源站全部 SSR、不做页面缓存；CDN 在边缘缓存公开页面。数据写成功后，除了
 * service 层按精确 id 调用的语义 helper（游戏/标签/同步等），这里在 API 层
 * 统一按路由前缀兜底：新增写接口只要路径落在映射里就自动清理相关页面。
 *
 * 只对 2xx 的 POST/PUT/PATCH/DELETE 触发；清理异步发出，不阻塞响应。
 * 评论页（路径以 /comment 结尾）等实时页面在 web 侧是 `no-store`，不在 CDN，无需清理。
 */
import {
  purgeByTags,
  purgeCollectionPages,
  purgeFriendLinksPage,
  purgeHomePage,
  purgeTopicPages,
} from './cloudflare-cache'

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

/** 写操作成功后的 CDN 失效（按路径分流）。 */
export async function invalidateAfterMutation(path: string): Promise<void> {
  try {
    if (path === '/collections' || path.startsWith('/collections/')) {
      const id = idFromPath(path, '/collections')
      if (id) {
        await purgeCollectionPages(id)
      } else {
        await purgeByTags(['page-collections', 'page-home'])
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

    if (path === '/adverts' || path.startsWith('/adverts/')) {
      // 广告位/素材影响所有公共页面的顶部广告：首页立即失效，
      // 其他页面靠较短的 s-maxage 窗口自愈
      await purgeHomePage()
      return
    }

    if (path === '/media' || path.startsWith('/media/')) {
      // 媒体图会影响游戏卡片/详情：列表与首页先失效
      await purgeByTags(['page-games', 'page-home'])
      return
    }
  } catch (error) {
    console.error('[cdn-invalidation] 写后失效失败:', error)
  }
}
