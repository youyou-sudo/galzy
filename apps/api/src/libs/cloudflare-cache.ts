/**
 * Cloudflare Cache Purge — ISR page cache invalidation
 *
 * Uses Cloudflare Cache API to purge cached HTML pages by URL, Cache-Tag,
 * or prefix. Called from API service modules when data changes.
 *
 * Requires env vars:
 *   CLOUDFLARE_ZONE_ID   — Zone ID from Cloudflare dashboard
 *   CLOUDFLARE_API_TOKEN — API token with "Cache Purge" permission
 */

import { publishIsrInvalidation } from './redis/pubsub'

const CF_API = 'https://api.cloudflare.com/client/v4'

async function cfPurge(
  path: string,
  body: Record<string, unknown>,
): Promise<void> {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID
  const token = process.env.CLOUDFLARE_API_TOKEN

  if (!zoneId || !token) {
    console.warn(
      '[cloudflare-cache] CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN not set, skipping purge',
    )
    return
  }

  try {
    const res = await fetch(`${CF_API}/zones/${zoneId}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      console.error(
        `[cloudflare-cache] purge failed (${res.status}):`,
        await res.text().catch(() => '<unreadable>'),
      )
      return
    }

    const data = await res.json()
    if (!data.success) {
      console.error(
        '[cloudflare-cache] purge API error:',
        JSON.stringify(data.errors ?? data),
      )
    }
  } catch (err) {
    console.error('[cloudflare-cache] purge request failed:', err)
  }
}

// ── Base purge operations ──

/** Purge by exact URLs (up to 30 per call) */
export async function purgeByUrls(urls: string[]): Promise<void> {
  if (urls.length === 0) return
  await cfPurge('purge_cache', { files: urls })
}

/** Purge by Cache-Tag (up to 30 per call) — preferred method */
export async function purgeByTags(tags: string[]): Promise<void> {
  if (tags.length === 0) return
  await cfPurge('purge_cache', { tags })
}

/** Purge by URL prefix, e.g. "/games/" clears /games, /games/123, etc. */
export async function purgeByPrefixes(prefixes: string[]): Promise<void> {
  if (prefixes.length === 0) return
  await cfPurge('purge_cache', { prefixes })
}

/** Purge everything — use with caution */
export async function purgeEverything(): Promise<void> {
  await cfPurge('purge_cache', { purge_everything: true })
}

// ── Domain-specific helpers ──
//
// 用户视图的缓存是两层：web 进程里的 ISR 页面缓存（Redis）+ CDN。
// 数据写完后这里只做一件事：把「失效哪些路径 / 哪些语义标签」发布到 Redis
// 频道（`galzy:isr:invalidate`）。web 订阅后删掉 ISR 页面产物，再把实际失效的
// URL 回传到 `galzy:isr:cdn-purge`，由 API 用 Cloudflare 凭据清边缘缓存。
// 这样 web 只需要一条 REDIS_URL，API 也不需要内部 HTTP 接口与共享密钥。

async function invalidateIsr(paths: string[], tags: string[]): Promise<void> {
  await publishIsrInvalidation({ paths, tags })
}

/** Game data changed: clear the game pages, homepage, and game list */
export async function purgeGamePages(gameId: string): Promise<void> {
  await invalidateIsr(
    [
      `/${gameId}`,
      `/${gameId}/comment`,
      `/${gameId}/introduction`,
      `/${gameId}/relations`,
      `/${gameId}/translate`,
    ],
    ['page-home', 'page-games'],
  )
}

/** Collection changed: clear the collection page, homepage, and collection list */
export async function purgeCollectionPages(
  collectionId: string,
): Promise<void> {
  await invalidateIsr(
    [`/collections/${collectionId}`],
    ['page-home', 'page-collections'],
  )
}

/** Tag translation changed: clear the tag page and tag list */
export async function purgeTagPages(tagId: string): Promise<void> {
  await invalidateIsr([`/tags/${tagId}`], ['page-tags'])
}

/** Producer changed */
export async function purgeProducerPages(producerId: string): Promise<void> {
  await invalidateIsr(
    [`/producer/${encodeURIComponent(producerId)}`],
    ['page-producers'],
  )
}

/** Homepage rankings updated (cron) */
export async function purgeHomePage(): Promise<void> {
  await invalidateIsr([], ['page-home'])
}

/** 论坛内容变化：列表（含全部分页/筛选变体）与指定主题详情 */
export async function purgeTopicPages(topicId?: string): Promise<void> {
  await invalidateIsr(topicId ? [`/topics/${topicId}`] : [], ['page-topics'])
}

/** 攻略文章变化：所属游戏的攻略页签（列表 + 文章详情） */
export async function purgeArticlePages(
  gameId: string,
  articleId?: string,
): Promise<void> {
  await invalidateIsr(
    [
      `/${gameId}/introduction`,
      ...(articleId ? [`/${gameId}/introduction/${articleId}`] : []),
    ],
    ['page-games'],
  )
}

/** 友情链接变化 */
export async function purgeFriendLinksPage(): Promise<void> {
  await invalidateIsr([], ['page-friend-links'])
}

/** VNDB sync completed — broad invalidation */
export async function purgeAfterSync(): Promise<void> {
  await invalidateIsr(
    [],
    [
      'page-home',
      'page-games',
      'page-tags',
      'page-collections',
      'page-producers',
    ],
  )
}
