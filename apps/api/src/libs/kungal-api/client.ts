import type {
  KungalCharacterAppearance,
  KungalCharacterAppearanceListData,
  KungalCharacterDetailListData,
  KungalCharacterItem,
  KungalCharacterListData,
  KungalProblem,
  KungalRedirect,
  KungalRedirectListData,
  KungalWalkthrough,
  KungalWalkthroughIndexListData,
  KungalWalkthroughIndexRow,
  KungalWalkthroughListData,
  KungalWorkCharacter,
  KungalWorkItem,
  KungalWorksListData,
} from './types'

const BASE = 'https://api.nextmoe.dev/v2'

/** refs= 批量通道上限（≤100/次）。 */
const REFS_BATCH = 100
/**
 * 全局攻略目录的翻页上限（100 条/页）。当前全站约 4.2k 条 → 43 页，这里留了
 * 近 7 倍余量；翻到上限还没追平说明上游游标坏了，宁可抛错也不要被当成
 * 「目录就这些」去删本地行。
 */
const WALKTHROUGH_INDEX_MAX_PAGES = 300
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

/**
 * 读取 kungal v2 应用密钥（每次调用现读，不在模块加载期快照）。
 *
 * 为什么不在模块顶层 `const KEY = process.env.KUNGALAPI_KEY`：
 * ① 那是加载期快照 —— 进程起来之后再设置/替换 env（测试替身、配置热读、
 *    部署注入顺序不同）一律读不到，只能重启进程；
 * ② 本项目真出现过 .env 里 KUNGALAPI_KEY 写两行（旧的 nm_ 前缀 v1 废钥 +
 *    新的 nmk_ 前缀 v2 钥）。快照写法把「用哪一行」完全交给加载器「后者
 *    覆盖前者」的实现细节，顺序一变就静默用上废钥，症状是整轮同步 401、
 *    而配置看起来「明明写了」。
 *
 * 规范化：去包裹引号、去首尾空白与换行（复制粘贴常带）、按空白/逗号拆多值
 * 后优先取 v2 密钥（nmk_ 前缀），没有候选就取第一个非空值。
 * 不合格返回 null，由调用方抛带指引的错。
 */
function readKey(): string | null {
  const raw = process.env.KUNGALAPI_KEY
  if (typeof raw !== 'string') return null
  const tokens = raw
    .split(/[\s,]+/)
    .map((token) => token.replace(/^["']+|["']+$/g, '').trim())
    .filter((token) => token.length > 0)
  if (tokens.length === 0) return null
  // 多值并存时优先 v2 前缀：v1 的 nm_ 废钥在 /v2 上直接 401（见 .env 历史）。
  return tokens.find((token) => token.startsWith('nmk_')) ?? tokens[0]
}

function authHeaders(): Record<string, string> {
  const key = readKey()
  if (!key) {
    throw new Error(
      'KUNGALAPI_KEY 未配置或为空：请在 apps/api/.env 配置 v2 应用密钥（nmk_ 前缀，' +
        '门户 developer.nextmoe.dev/dashboard 自助铸造），并删除旧的 nm_ 前缀 v1 密钥',
    )
  }
  return { Authorization: `Bearer ${key}` }
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

/**
 * 一个作品的攻略列表：GET /catalog/walkthroughs?work_id=…&nsfw=true，游标翻页取全。
 *
 * 列表行**不含 chart**（整棵选择图只在详情接口下发），但带 updated_at 与
 * 三个计数，所以同步侧可以先只拉列表：updated_at 没变的行不必再拉详情。
 * 同一作品可能有多条（日文原版 / 汉化 / 不同作者），id 全局唯一。
 */
export async function fetchWorkWalkthroughs(
  workId: string,
): Promise<KungalWalkthrough[]> {
  const out: KungalWalkthrough[] = []
  let cursor: string | undefined
  // 页数上限防止上游游标坏掉时空转（与名册/出场列表同一个防御口径）
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({
      work_id: workId,
      nsfw: 'true',
      limit: String(REFS_BATCH),
    })
    if (cursor) params.set('cursor', cursor)
    const data = await request<KungalWalkthroughListData>(
      `/catalog/walkthroughs?${params.toString()}`,
    )
    out.push(...(data.items ?? []))
    cursor = data.next_cursor ?? undefined
    if (!cursor) break
  }
  return out
}

/**
 * 全站攻略目录：不带 work_id 的 GET /catalog/walkthroughs 就是全量集合
 * （id 键集分页，100 条/页），翻完一遍就是「上游现在有哪些攻略」的权威人口。
 *
 * 用 fields= 裁到 id/work_id/updated_at：这一遍只做发现与变更比对，真正要
 * 落库的行再走 fetchWalkthroughsByIds 批量水合（完整列表行，仍不含 chart）。
 * 这样全站 4.2k 条攻略的「发现」从「每部作品一次列表请求」降到 ~43 个请求。
 *
 * 翻到页数上限仍未追平会抛错：同步侧据此放弃删除，避免把半截目录当成
 * 「全都下线」而误删一大片。
 */
export async function fetchWalkthroughIndex(options?: {
  maxPages?: number
}): Promise<KungalWalkthroughIndexRow[]> {
  const maxPages = Math.max(options?.maxPages ?? WALKTHROUGH_INDEX_MAX_PAGES, 1)
  const out: KungalWalkthroughIndexRow[] = []
  let cursor: string | undefined
  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      nsfw: 'true',
      limit: String(REFS_BATCH),
      fields: 'id,work_id,updated_at',
    })
    if (cursor) params.set('cursor', cursor)
    const data = await request<KungalWalkthroughIndexListData>(
      `/catalog/walkthroughs?${params.toString()}`,
    )
    out.push(...(data.items ?? []))
    cursor = data.next_cursor ?? undefined
    // 末页整体缺省 next_cursor（不是 null）：判空要写 `if (!cursor)`
    if (!cursor) return out
  }
  throw new Error(
    `Kungal 攻略目录超过 ${maxPages} 页仍未追平（已收 ${out.length} 条），本轮放弃（不删本地行）`,
  )
}

/**
 * ids= 批量刷新攻略列表行（≤100/次；批量车道无分页，也不带 chart）。
 *
 * 必须带 nsfw=true：r18 作品的行否则整条落进 missing[]。这不是理论问题 ——
 * work 15 就是 content_rating=r18 / content_limit=sfw，不带 nsfw 时 ids= 返回空。
 */
export async function fetchWalkthroughsByIds(
  ids: string[],
): Promise<KungalWalkthrough[]> {
  const unique = [
    ...new Set(
      ids.map((id) => id?.trim()).filter((id): id is string => Boolean(id)),
    ),
  ]
  const out: KungalWalkthrough[] = []
  for (let i = 0; i < unique.length; i += REFS_BATCH) {
    const chunk = unique.slice(i, i + REFS_BATCH)
    const params = new URLSearchParams({
      ids: chunk.join(','),
      nsfw: 'true',
    })
    const data = await request<KungalWalkthroughListData>(
      `/catalog/walkthroughs?${params.toString()}`,
    )
    out.push(...(data.items ?? []))
  }
  return out
}

/**
 * 单条攻略详情（含 chart）；404（作品不可见 / 攻略已下线）返回 null。
 *
 * 用 nsfw=true：本地库不做成人向过滤（前端按作品分级自己决定是否展示），
 * 同步侧必须拿到全量数据，否则 r18 作品的攻略会整批缺行。
 */
export async function fetchWalkthrough(
  id: string,
): Promise<KungalWalkthrough | null> {
  try {
    return await request<KungalWalkthrough>(
      `/catalog/walkthroughs/${encodeURIComponent(id)}?nsfw=true`,
    )
  } catch (err) {
    if (err instanceof KungalApiError && err.status === 404) return null
    throw err
  }
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
  fetchWorkWalkthroughs,
  fetchWalkthroughIndex,
  fetchWalkthroughsByIds,
  fetchWalkthrough,
  lookupWork,
}
