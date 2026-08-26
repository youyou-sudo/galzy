import type {
  KungalProblem,
  KungalWorkItem,
  KungalWorksListData,
} from './types'

const BASE = 'https://api.nextmoe.dev/v2'
const KEY = process.env.KUNGALAPI_KEY

/** refs= 批量通道上限（≤100/次）。 */
const REFS_BATCH = 100
const RESOLVE_CONCURRENCY = 4
/** works 批量水合/解析共用的 include 块（v2 中 titles 取代 v1 的 names）。 */
const WORKS_INCLUDE = 'titles,intros,covers,ratings,refs'

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

/** RFC 9457 业务错误：携带 HTTP status 与顶层错误 code，不参与网络重试。 */
export class KungalApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    detail?: string,
  ) {
    super(detail || code || `Kungal API ${status}`)
  }
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
      if (!res.ok) {
        let problem: KungalProblem | undefined
        try {
          problem = (await res.json()) as KungalProblem
        } catch {
          // 非 JSON 错误体，按 status 兜底
        }
        if (res.status >= 500 && attempt < retries) {
          await new Promise((r) => setTimeout(r, 500 * attempt))
          continue
        }
        throw new KungalApiError(
          res.status,
          problem?.code ?? null,
          problem?.detail,
        )
      }
      return (await res.json()) as T
    } catch (err) {
      if (err instanceof KungalApiError) throw err
      if (attempt === retries) throw err
      await new Promise((r) => setTimeout(r, 500 * attempt))
    }
  }
  throw new Error(`Kungal API ${path} failed after ${retries} retries`)
}

/** 防御：确认行 refs 确实锚定该 vid（大小写不敏感）。 */
function anchoredToVndb(item: KungalWorkItem, vid: string): boolean {
  return (item.refs ?? []).some(
    (r) =>
      r.source === 'vndb' && r.external_id?.toLowerCase() === vid.toLowerCase(),
  )
}

/** refs= 批量通道：一次取回 ≤100 个 source:external_id 锚点对应的 works-list 行。 */
async function fetchWorksByRefs(refs: string[]): Promise<KungalWorkItem[]> {
  const data = await request<KungalWorksListData>(
    `/catalog/works?refs=${refs.map(encodeURIComponent).join(',')}&include=${WORKS_INCLUDE}&nsfw=true&limit=${REFS_BATCH}`,
  )
  return data.items ?? []
}

/** 按 VNDB 锚点精确解析作品（refs= 批量通道；未命中/被隐藏 → null）。 */
export async function resolveWorkByVndbId(
  vid: string,
): Promise<KungalWorkItem | null> {
  const items = await fetchWorksByRefs([`vndb:${vid}`])
  return items.find((item) => anchoredToVndb(item, vid)) ?? null
}

/** 批量解析（refs= 批量通道 ≤100/次，并发 4），返回 vid → item 的 Map；未命中不出现。 */
export async function resolveWorksByVndbIds(
  vids: string[],
  onProgress?: (processed: number, total: number) => void,
): Promise<Map<string, KungalWorkItem>> {
  const result = new Map<string, KungalWorkItem>()
  const chunks: string[][] = []
  for (let i = 0; i < vids.length; i += REFS_BATCH) {
    chunks.push(vids.slice(i, i + REFS_BATCH))
  }
  let idx = 0
  let done = 0
  const worker = async () => {
    while (idx < chunks.length) {
      const chunk = chunks[idx++]
      try {
        const items = await fetchWorksByRefs(chunk.map((v) => `vndb:${v}`))
        for (const vid of chunk) {
          const hit = items.find((item) => anchoredToVndb(item, vid))
          if (hit) result.set(vid, hit)
        }
      } catch (err) {
        console.error(`❌ Kungal resolve chunk ${chunk[0]}… failed:`, err)
      }
      done += chunk.length
      if (onProgress) onProgress(done, vids.length)
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(RESOLVE_CONCURRENCY, chunks.length) },
      worker,
    ),
  )
  return result
}

/** 按 kungal work id 批量水合（≤100/次，缺 id 静默丢弃）。 */
export async function hydrateWorksByIds(
  ids: string[],
): Promise<KungalWorkItem[]> {
  const chunks: KungalWorkItem[] = []
  for (let i = 0; i < ids.length; i += REFS_BATCH) {
    const chunk = ids.slice(i, i + REFS_BATCH)
    const data = await request<KungalWorksListData>(
      `/catalog/works?ids=${chunk.join(',')}&include=${WORKS_INCLUDE}&nsfw=true`,
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
  const items = await fetchWorksByRefs([`${source}:${externalId}`])
  return items[0] ?? null
}

export const KungalClient = {
  resolveWorkByVndbId,
  resolveWorksByVndbIds,
  hydrateWorksByIds,
  lookupWork,
}
