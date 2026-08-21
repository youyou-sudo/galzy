import type {
  KungalEnvelope,
  KungalLookupData,
  KungalWorkItem,
  KungalWorksListData,
  KungalWorksSearchData,
} from './types'

const BASE = 'https://api.nextmoe.dev'
const KEY = process.env.KUNGALAPI_KEY

const RESOLVE_CONCURRENCY = 12

/** 令牌桶限流：平台免费但有防滥用限流，保持温和的 20 req/s。 */
class RateLimiter {
  private tokens = 20
  private lastRefill = Date.now()

  async acquire(): Promise<void> {
    const now = Date.now()
    this.tokens = Math.min(
      20,
      this.tokens + ((now - this.lastRefill) / 1000) * 20,
    )
    this.lastRefill = now
    if (this.tokens < 1) {
      await new Promise((r) => setTimeout(r, 60))
      return this.acquire()
    }
    this.tokens--
  }
}

const limiter = new RateLimiter()

function authHeaders(): Record<string, string> {
  if (!KEY) {
    throw new Error('KUNGALAPI_KEY 未配置（apps/api/.env）')
  }
  return { Authorization: `Bearer ${KEY}` }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  retries = 3,
): Promise<T> {
  await limiter.acquire()
  const url = `${BASE}${path}`
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { ...authHeaders(), ...init?.headers },
      })
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1000 * attempt))
        continue
      }
      const body = (await res.json()) as KungalEnvelope<unknown>
      if (body.code !== 0) {
        throw new Error(`Kungal API ${path} 失败: ${body.message}`)
      }
      return body.data as T
    } catch (err) {
      if (attempt === retries) throw err
      await new Promise((r) => setTimeout(r, 500 * attempt))
    }
  }
  throw new Error(`Kungal API ${path} failed after ${retries} retries`)
}

/**
 * 按 VNDB 锚点精确解析作品（works/search 对恰为 VNDB work id 的 q 短路到精确锚点）。
 * 返回完整的 works-list 行（已带 include 块）或 null（无锚点/未命中）。
 */
export async function resolveWorkByVndbId(
  vid: string,
): Promise<KungalWorkItem | null> {
  const data = await request<KungalWorksSearchData>(
    `/v1/catalog/works/search?q=${encodeURIComponent(vid)}&nsfw=1&limit=1&include=names,intros,covers,ratings,refs`,
  )
  const item = data.items?.[0]
  if (!item) return null
  // 防御：确认命中行的 refs 确实锚定该 vid（大小写不敏感）
  const refs = (item.refs ?? []) as Array<{
    source?: string
    external_id?: string
  }>
  const anchored = refs.some(
    (r) =>
      r.source === 'vndb' && r.external_id?.toLowerCase() === vid.toLowerCase(),
  )
  return anchored ? item : null
}

/** 批量解析（有限并发），返回 vid → item 的 Map；未命中不出现。 */
export async function resolveWorksByVndbIds(
  vids: string[],
  onProgress?: (processed: number, total: number) => void,
): Promise<Map<string, KungalWorkItem>> {
  const result = new Map<string, KungalWorkItem>()
  let idx = 0
  let done = 0
  const worker = async () => {
    while (idx < vids.length) {
      const vid = vids[idx++]
      try {
        const item = await resolveWorkByVndbId(vid)
        if (item) result.set(vid, item)
      } catch (err) {
        console.error(`❌ Kungal resolve ${vid} failed:`, err)
      }
      done++
      if (onProgress) onProgress(done, vids.length)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(RESOLVE_CONCURRENCY, vids.length) }, worker),
  )
  return result
}

/** 按 kungal work id 批量水合（≤100/次，缺 id 静默丢弃）。 */
export async function hydrateWorksByIds(
  ids: string[],
): Promise<KungalWorkItem[]> {
  const chunks: KungalWorkItem[] = []
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const data = await request<KungalWorksListData>(
      `/v1/catalog/works?ids=${chunk.join(',')}&include=names,intros,covers,ratings,refs&nsfw=1`,
    )
    chunks.push(...(data.items ?? []))
  }
  return chunks
}

/** 单条反查（备用；批量解析走 resolveWorksByVndbIds）。 */
export async function lookupWork(
  source: string,
  externalId: string,
): Promise<KungalWorkItem | null> {
  const data = await request<KungalLookupData>(
    `/v1/catalog/lookup?source=${encodeURIComponent(source)}&external_id=${encodeURIComponent(externalId)}&type=work&nsfw=1`,
  )
  return data.work ?? null
}

export const KungalClient = {
  resolveWorkByVndbId,
  resolveWorksByVndbIds,
  hydrateWorksByIds,
  lookupWork,
}
