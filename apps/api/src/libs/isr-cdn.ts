/**
 * CDN（Cloudflare）按 URL 清理。
 *
 * 调用方是「web 失效了哪些页面」的订阅者（见 `redis/pubsub.ts`）：
 * web 侧 `cachePurger` 拿到的是**实际被清掉的 physical path**，这里拼上站点
 * origin 后交给 Cloudflare。这样 web 进程不再需要任何 CDN 凭据/域名配置，
 * 只保留一条 `REDIS_URL`；凭据留在本来就有它们的 API 进程。
 *
 * 环境变量（API 侧，缺省则跳过 CDN 清理）：
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

/** 把站内路径（physical path）转成绝对 URL；外链原样保留。 */
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

export async function purgeCdnUrls(paths: readonly string[]): Promise<void> {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!zoneId || !token) {
    if (!warnedMissingConfig) {
      warnedMissingConfig = true
      console.warn(
        '[isr] 未配置 CLOUDFLARE_ZONE_ID / CLOUDFLARE_API_TOKEN：跳过 CDN 清理（仅源站失效）',
      )
    }
    return
  }

  const urls = absoluteUrls(paths)
  if (urls.length === 0) {
    if (!warnedMissingConfig) {
      warnedMissingConfig = true
      console.warn('[isr] 未配置 SITE_URL / WEB_HOST：跳过 CDN 清理')
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
          `[isr] CDN 清理失败 (${res.status}):`,
          await res.text().catch(() => '<unreadable>'),
        )
        continue
      }
      const data = (await res.json()) as { success?: boolean; errors?: unknown }
      if (!data.success) {
        console.error('[isr] CDN 清理返回错误:', JSON.stringify(data.errors))
      }
    } catch (error) {
      console.error('[isr] CDN 清理请求异常:', error)
    }
  }
}
