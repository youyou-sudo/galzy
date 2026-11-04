import type {
  KungalCharacterAppearance,
  KungalCharacterAppearanceListData,
  KungalCharacterDetailListData,
  KungalCharacterItem,
  KungalCharacterListData,
  KungalProblem,
  KungalRedirect,
  KungalRedirectListData,
  KungalWorkCharacter,
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

/**
 * 角色详情水合需要的 include 块（名册行只有名字/图片/戏份，没有这些）。
 *
 * view=full 实测已包含大部分块，但 spec 只把 view 写成「展开次要字段」，
 * 显式列全 15 个合法 token 才能保证上游调整 view 语义时不缺块。
 */
const CHARACTER_INCLUDE =
  'gender,birthday,height_cm,weight_kg,measurements,blood_type,instance_of_id,image,figure,traits,aliases,intros,refs,links,work_count'

/** works/{id}/characters 名册单页（游标翻页用；limit 上限 100）。 */
async function fetchWorkCharacterPage(
  workId: string,
  cursor?: string,
): Promise<KungalCharacterListData> {
  const params = new URLSearchParams({
    limit: String(REFS_BATCH),
    nsfw: 'true',
  })
  if (cursor) params.set('cursor', cursor)
  return await request<KungalCharacterListData>(
    `/catalog/works/${encodeURIComponent(workId)}/characters?${params.toString()}`,
  )
}

/** refs= 批量通道：一次取回 ≤100 个 source:external_id 锚点对应的 works-list 行。 */
async function fetchWorksByRefs(refs: string[]): Promise<KungalWorkItem[]> {
  const data = await request<KungalWorksListData>(
    `/catalog/works?refs=${refs.map(encodeURIComponent).join(',')}&include=${WORKS_INCLUDE}&nsfw=true&limit=${REFS_BATCH}`,
  )
  return data.items ?? []
}

/** ids= 批量通道：一次取回 ≤100 个 kungal work id 对应的 works-list 行。 */
async function fetchWorksByIds(ids: string[]): Promise<KungalWorkItem[]> {
  const data = await request<KungalWorksListData>(
    `/catalog/works?ids=${ids.map(encodeURIComponent).join(',')}&include=${WORKS_INCLUDE}&nsfw=true&limit=${REFS_BATCH}`,
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

/** 按 kungal work id 批量解析（ids= 批量通道 ≤100/次，并发 4），返回 id → item；未命中不出现。 */
export async function resolveWorksByKungalIds(
  ids: string[],
  onProgress?: (processed: number, total: number) => void,
): Promise<Map<string, KungalWorkItem>> {
  const result = new Map<string, KungalWorkItem>()
  const unique = [...new Set(ids.map((i) => i?.trim()).filter(Boolean))]
  const chunks: string[][] = []
  for (let i = 0; i < unique.length; i += REFS_BATCH) {
    chunks.push(unique.slice(i, i + REFS_BATCH))
  }
  let idx = 0
  let done = 0
  const worker = async () => {
    while (idx < chunks.length) {
      const chunk = chunks[idx++]
      try {
        const items = await fetchWorksByIds(chunk)
        for (const id of chunk) {
          const hit = items.find((item) => String(item.id) === id)
          if (hit) result.set(id, hit)
        }
      } catch (err) {
        console.error(`❌ Kungal resolve(ids) chunk ${chunk[0]}… failed:`, err)
      }
      done += chunk.length
      if (onProgress) onProgress(done, unique.length)
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
    chunks.push(...(await fetchWorksByIds(ids.slice(i, i + REFS_BATCH))))
  }
  return chunks
}

/**
 * 作品名册：GET /catalog/works/{id}/characters 游标翻页取全。
 *
 * 名册行只有 nsfw/cursor/limit 三个参数（没有 view/include），行内只有
 * display_name/latin/localized/image/figure/roster_role/spoiler —— 角色资料
 * 字段要靠 hydrateCharactersByIds 再水合一次。
 */
export async function fetchWorkCharacters(
  workId: string,
): Promise<KungalWorkCharacter[]> {
  const out: KungalWorkCharacter[] = []
  let cursor: string | undefined
  // 上限 20 页（最多 2000 个角色）：目录里没有这么大的名册，出现异常分页
  // 说明上游游标坏了，宁可截断也不要在这里无限循环。
  for (let page = 0; page < 20; page++) {
    const data = await fetchWorkCharacterPage(workId, cursor)
    out.push(...(data.items ?? []))
    cursor = data.next_cursor ?? undefined
    if (!cursor) break
  }
  return out
}

/**
 * 角色批量水合：GET /catalog/characters?ids=…&view=full&include=…
 *
 * ids= 是批量通道（≤100/次、无分页），view=full 展开 gender/birthday/
 * blood_type/身高体重/三围/instance_of_id，include 再带图片、figure、简介、
 * traits 与 refs。未命中的 id 只出现在 missing 里，不抛错。
 *
 * 已知上限：该通道没有 spoiler 参数，traits 只返回 spoiler=none 的一档；
 * minor/major 级属性要逐角色走 /catalog/characters/{id}?spoiler=major 补取
 * （无批量通道）。角色卡默认不展示剧透属性，本期接受这个口径。
 */
export async function hydrateCharactersByIds(
  ids: string[],
): Promise<KungalCharacterItem[]> {
  const unique = [...new Set(ids.map((i) => i?.trim()).filter(Boolean))]
  const out: KungalCharacterItem[] = []
  for (let i = 0; i < unique.length; i += REFS_BATCH) {
    const chunk = unique.slice(i, i + REFS_BATCH)
    const data = await request<KungalCharacterDetailListData>(
      `/catalog/characters?ids=${chunk.map(encodeURIComponent).join(',')}&view=full&include=${CHARACTER_INCLUDE}&nsfw=true&limit=${REFS_BATCH}`,
    )
    out.push(...(data.items ?? []))
  }
  return out
}

/** 单个角色详情；404（不存在或被隐藏）返回 null，交给调用方决定报错口径。 */
export async function fetchCharacter(
  id: string,
): Promise<KungalCharacterItem | null> {
  try {
    return await request<KungalCharacterItem>(
      `/catalog/characters/${encodeURIComponent(id)}?view=full&include=${CHARACTER_INCLUDE}&nsfw=true`,
    )
  } catch (err) {
    if (err instanceof KungalApiError && err.status === 404) return null
    throw err
  }
}

/** 角色的出场作品（含 roster_role/spoiler），游标翻页取全。 */
export async function fetchCharacterAppearances(
  id: string,
): Promise<KungalCharacterAppearance[]> {
  const out: KungalCharacterAppearance[] = []
  let cursor: string | undefined
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({
      limit: String(REFS_BATCH),
      nsfw: 'true',
    })
    if (cursor) params.set('cursor', cursor)
    const data = await request<KungalCharacterAppearanceListData>(
      `/catalog/characters/${encodeURIComponent(id)}/appearances?${params.toString()}`,
    )
    out.push(...(data.items ?? []))
    cursor = data.next_cursor ?? undefined
    if (!cursor) break
  }
  return out
}

/** redirects feed：id 收敛（merge）事件，按 work 族过滤、游标翻页（最多 maxPages 页）。 */
export async function fetchWorkRedirects(options?: {
  limit?: number
  maxPages?: number
}): Promise<KungalRedirect[]> {
  const limit = Math.min(Math.max(options?.limit ?? REFS_BATCH, 1), REFS_BATCH)
  const maxPages = Math.max(options?.maxPages ?? 10, 1)
  const out: KungalRedirect[] = []
  let cursor: string | undefined
  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      object: 'work',
      limit: String(limit),
    })
    if (cursor) params.set('cursor', cursor)
    const data = await request<KungalRedirectListData>(
      `/catalog/redirects?${params.toString()}`,
    )
    out.push(...(data.items ?? []))
    cursor = data.next_cursor ?? undefined
    if (!cursor) break
  }
  return out
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
  resolveWorksByKungalIds,
  hydrateWorksByIds,
  fetchWorkCharacters,
  hydrateCharactersByIds,
  fetchCharacter,
  fetchCharacterAppearances,
  fetchWorkRedirects,
  lookupWork,
}
