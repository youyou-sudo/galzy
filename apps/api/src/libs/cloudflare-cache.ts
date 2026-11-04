/**
 * CDN（Cloudflare）按 URL 清理 —— 写操作后的主动失效。
 *
 * 源站不做任何页面缓存（全部 SSR），公开页面由 CDN 依据响应头
 * `Cache-Control: public, max-age=0, s-maxage=<N>, stale-while-revalidate=<N>`
 * 在边缘缓存；评论等实时页面由 web 侧标记为 `no-store`，不进 CDN。
 *
 * 数据写成功后由 service 层调用这里的语义 helper，用 Cloudflare
 * `purge_cache` API 按 URL 清掉对应页面。列表页的查询串变体无法枚举，
 * 依赖较短的 `s-maxage` / `stale-while-revalidate` 自愈。
 *
 * 环境变量（API 侧，缺省则跳过清理）：
 * - `SITE_URL`（或 `WEB_HOST`）：站点 origin
 * - `CLOUDFLARE_ZONE_ID` / `CLOUDFLARE_API_TOKEN`
 */
const CF_API = 'https://api.cloudflare.com/client/v4'
const MAX_URLS_PER_PURGE = 30

let warnedMissingConfig = false

function origin(): string | null {
  const raw = process.env.SITE_URL ?? process.env.WEB_HOST
  if (!raw) return null
  return raw.replace(/\/+$/, '')
}

/** 把站内路径转成绝对 URL；外链原样保留。 */
function absoluteUrls(paths: readonly string[]): string[] {
  const base = origin()
  if (!base) return []
  const urls = new Set<string>()
  for (const path of paths) {
    if (!path) continue
    if (/^https?:\/\//.test(path)) {
      urls.add(path)
      continue
    }
    urls.add(base + (path.startsWith('/') ? path : `/${path}`))
  }
  return [...urls]
}

/** 按绝对/站内路径清 CDN（每批最多 30 条）。 */
export async function purgeCdnUrls(paths: readonly string[]): Promise<void> {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!zoneId || !token) {
    if (!warnedMissingConfig) {
      warnedMissingConfig = true
      console.warn(
        '[cdn] 未配置 CLOUDFLARE_ZONE_ID / CLOUDFLARE_API_TOKEN：跳过 CDN 清理',
      )
    }
    return
  }

  const urls = absoluteUrls(paths)
  if (urls.length === 0) {
    if (!warnedMissingConfig) {
      warnedMissingConfig = true
      console.warn('[cdn] 未配置 SITE_URL / WEB_HOST：跳过 CDN 清理')
    }
    return
  }

  for (let start = 0; start < urls.length; start += MAX_URLS_PER_PURGE) {
    const files = urls.slice(start, start + MAX_URLS_PER_PURGE)
    try {
      const res = await fetch(`${CF_API}/zones/${zoneId}/purge_cache`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        console.error(
          `[cdn] CDN 清理失败 (${res.status}):`,
          await res.text().catch(() => '<unreadable>'),
        )
        continue
      }
      const data = (await res.json()) as { success?: boolean; errors?: unknown }
      if (!data.success) {
        console.error('[cdn] CDN 清理返回错误:', JSON.stringify(data.errors))
      }
    } catch (error) {
      console.error('[cdn] CDN 清理请求异常:', error)
    }
  }
}

// ── 语义 helper ──

/** 兼容旧调用：语义标签映射到对应的列表/首页 URL。 */
const TAG_TO_PATH: Record<string, string> = {
  'page-home': '/',
  'page-games': '/games',
  'page-tags': '/tags',
  'page-collections': '/collections',
  'page-producers': '/producer',
  'page-topics': '/topics',
  'page-friend-links': '/friend-links',
}

export async function purgeByTags(tags: readonly string[]): Promise<void> {
  await purgeCdnUrls(
    tags
      .map((tag) => TAG_TO_PATH[tag])
      .filter((path): path is string => !!path),
  )
}

/** 游戏详情及其全部页签 + 列表 + 首页。 */
export async function purgeGamePages(gameId: string): Promise<void> {
  await purgeCdnUrls([
    `/${gameId}`,
    `/${gameId}/comment`,
    // 攻略页签已换成 kungal walkthrough（站内攻略文章下线，/{gameId}/introduction
    // 路由已不存在，继续清它只会白占 Cloudflare purge 配额）。
    `/${gameId}/walkthrough`,
    `/${gameId}/relations`,
    `/${gameId}/translate`,
    '/games',
    '/',
  ])
}

export async function purgeCollectionPages(
  collectionId: string,
): Promise<void> {
  await purgeCdnUrls([`/collections/${collectionId}`, '/collections', '/'])
}

export async function purgeTagPages(tagId: string): Promise<void> {
  await purgeCdnUrls([`/tags/${tagId}`, '/tags', '/'])
}

export async function purgeProducerPages(producerId: string): Promise<void> {
  await purgeCdnUrls([
    `/producer/${encodeURIComponent(producerId)}`,
    '/producer',
    '/',
  ])
}

export async function purgeHomePage(): Promise<void> {
  await purgeCdnUrls(['/'])
}

export async function purgeTopicPages(topicId?: string): Promise<void> {
  await purgeCdnUrls(
    topicId ? [`/topics/${topicId}`, '/topics', '/'] : ['/topics', '/'],
  )
}

export async function purgeFriendLinksPage(): Promise<void> {
  await purgeCdnUrls(['/friend-links'])
}

/** VNDB/Kungal 同步完成 —— 清理全部公共列表与首页（详情页靠列表入口/短 TTL 自愈）。 */
export async function purgeAfterSync(): Promise<void> {
  await purgeCdnUrls(['/', '/games', '/tags', '/collections', '/producer'])
}
