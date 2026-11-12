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

/**
 * 上游配额：文档写明 600 次/分钟。
 *
 * 默认只用一半（300 次/分 = 5 req/s）。为什么不拉满：配额按分钟窗口计，
 * 「刚好卡在 600」的长跑任务在窗口边界整段 429，退避一次就是几十秒；同步
 * 任务又是「几十次批量 + 上千次详情」的形态，撞限流的代价远高于多花几分钟。
 * 需要更保守时可用 KUNGAL_RATE_PER_MIN 往下调（只降不升）。
 */
const UPSTREAM_QUOTA_PER_MIN = 600
const DEFAULT_RATE_PER_MIN = Math.floor(UPSTREAM_QUOTA_PER_MIN / 2)

/** 环境覆盖：只接受正整数，且永远不会超过「折半」这条硬线。 */
function readRatePerMin(): number {
  const parsed = Number(process.env.KUNGAL_RATE_PER_MIN)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_RATE_PER_MIN
  return Math.min(Math.floor(parsed), DEFAULT_RATE_PER_MIN)
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * 进程级令牌桶：全站（作品/角色/攻略/跑批脚本）共用一条队列。
 *
 * 与旧实现（固定 20 req/s、令牌不够就 sleep 60ms 递归重试）的差别：
 * ① 旧的持续速率是 1200 次/分，正好是上游配额的两倍 —— 一跑同步就 429；
 * ② 旧版只让「收到 429 的那条请求」退避，同批并发请求照打，越退避越堵；
 *    这里 429 会冻结整条等待队列（penalize），所有调用方一起退。
 *
 * 容量封顶 1 秒额度（默认 5 个）：允许小幅突发，但不允许把攒下的额度
 * 一口气打出去。
 */
class TokenBucket {
  readonly ratePerMin: number
  private readonly capacity: number
  private readonly perMs: number
  private tokens: number
  private lastRefill = Date.now()
  private cooldownUntil = 0
  private waiters: Array<() => void> = []
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(ratePerMin: number) {
    this.ratePerMin = Math.max(1, Math.floor(ratePerMin))
    const perSec = this.ratePerMin / 60
    this.capacity = Math.max(1, perSec)
    this.perMs = perSec / 1000
    this.tokens = this.capacity
  }

  /** 取一个令牌；额度不足时排队等待，不让调用方 sleep 轮询。 */
  async acquire(): Promise<void> {
    if (this.waiters.length === 0) {
      const now = Date.now()
      if (now >= this.cooldownUntil) {
        this.refill(now)
        if (this.tokens >= 1) {
          this.tokens -= 1
          return
        }
      }
    }
    await new Promise<void>((resolve) => {
      this.waiters.push(resolve)
      this.drain()
    })
  }

  /** 收到 429：整条队列按 Retry-After 冻结（1~120s），攒下的令牌清零。 */
  penalize(seconds: number) {
    const wait = Math.min(Math.max(seconds, 1), 120)
    this.cooldownUntil = Math.max(this.cooldownUntil, Date.now() + wait * 1000)
    this.tokens = 0
    this.lastRefill = Date.now()
    this.drain()
  }

  private refill(now: number) {
    this.tokens = Math.min(
      this.capacity,
      this.tokens + (now - this.lastRefill) * this.perMs,
    )
    this.lastRefill = now
  }

  private drain() {
    if (this.timer || this.waiters.length === 0) return
    const now = Date.now()
    if (now < this.cooldownUntil) {
      this.timer = setTimeout(() => {
        this.timer = null
        this.drain()
      }, this.cooldownUntil - now)
      return
    }
    this.refill(now)
    if (this.tokens < 1) {
      this.timer = setTimeout(
        () => {
          this.timer = null
          this.drain()
        },
        Math.max(1, Math.ceil((1 - this.tokens) / this.perMs)),
      )
      return
    }
    this.tokens -= 1
    this.waiters.shift()?.()
    if (this.waiters.length === 0) return
    // 还有排队者：本次扣掉的令牌可能仍够下一个，下一拍继续。让出事件循环，
    // 避免在同一个微任务里把一桶令牌全发出去。
    this.timer = setTimeout(
      () => {
        this.timer = null
        this.drain()
      },
      this.tokens >= 1
        ? 0
        : Math.max(1, Math.ceil((1 - this.tokens) / this.perMs)),
    )
  }
}

/**
 * 懒初始化：与密钥同理，env 可能在本模块加载之后才注入（测试替身、部署注入
 * 顺序不同），所以不在模块顶层快照速率。
 */
let limiter: TokenBucket | null = null
function getLimiter(): TokenBucket {
  if (!limiter) limiter = new TokenBucket(readRatePerMin())
  return limiter
}

/** 当前生效限速（次/分）：排查同步耗时 / 限流时打日志用。 */
export function kungalRatePerMin(): number {
  return getLimiter().ratePerMin
}

/**
 * 拆 .env 里的候选钥：去包裹引号、去首尾空白与换行（复制粘贴常带）、
 * 按空白/逗号拆多值。
 */
function readKeyCandidates(): string[] {
  const raw = process.env.KUNGALAPI_KEY
  if (typeof raw !== 'string') return []
  return raw
    .split(/[\s,]+/)
    .map((token) => token.replace(/^["']+|["']+$/g, '').trim())
    .filter((token) => token.length > 0)
}

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
 * 只认 v2 应用密钥（nmk_ 前缀）：一个 nmk_ 都没有时返回 null，由
 * authHeaders 抛带指引的错 —— 绝不拿 v1 废钥去打 /v2。
 */
function readKey(): string | null {
  // 多值并存时（.env 历史里留了旧的 nm_ v1 废钥）取 nmk_ 那把。
  // 只剩废钥时返回 null，由 authHeaders 抛「换钥」的错 —— 拿废钥发请求
  // 等于「不带 key 硬打」，症状是整轮同步 401 而不是这里明说。
  return readKeyCandidates().find((token) => token.startsWith('nmk_')) ?? null
}

/** 报错时只露前 8 位，既能区分是哪把钥，又不会把密钥写进日志。 */
function keyHint(key: string): string {
  return key.length > 8 ? `${key.slice(0, 8)}…` : `${key.slice(0, 4)}…`
}

function authHeaders(): Record<string, string> {
  const key = readKey()
  if (key) return { Authorization: `Bearer ${key}` }
  const candidates = readKeyCandidates()
  if (candidates.length === 0) {
    throw new Error(
      'KUNGALAPI_KEY 未配置或为空：请在 apps/api/.env 配置 v2 应用密钥（nmk_ 前缀，' +
        '门户 developer.nextmoe.dev/dashboard 自助铸造），并删除旧的 nm_ 前缀 v1 密钥',
    )
  }
  throw new Error(
    `KUNGALAPI_KEY 里没有 v2 应用密钥（须 nmk_ 前缀）：当前候选 ${candidates
      .map((token) => `'${keyHint(token)}'`)
      .join(
        '、',
      )}。v1 的 nm_ 废弃钥在 /v2 上一律 401，请换成门户铸造的 nmk_ 钥`,
  )
}

/**
 * 同步入口的快速失败：缺钥 / 钥不是 nmk_ 时，在动数据库、起队列之前就抛，
 * 而不是每条请求 401、最后收下一堆 per-batch 错误。
 */
export function assertKungalKey(): void {
  authHeaders()
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

/** 单次请求的重试预算（429 / 5xx / 网络错误共用）。 */
const REQUEST_RETRIES = 3

/** 解析 Retry-After（秒数或 HTTP 日期）；缺省 / 非法返回 0。 */
function parseRetryAfter(value: string | null): number {
  if (!value) return 0
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds > 0) return seconds
  const date = Date.parse(value)
  if (Number.isNaN(date)) return 0
  return Math.max(0, Math.ceil((date - Date.now()) / 1000))
}

async function request<T>(
  path: string,
  init?: RequestInit,
  retries = REQUEST_RETRIES,
): Promise<T> {
  const url = `${BASE}${path}`
  // 认证头在排队之前算好：缺钥 / 废钥直接抛，不占限流额度，也绝不发匿名请求。
  const headers = { ...authHeaders(), ...init?.headers }
  const limiter = getLimiter()
  let lastError: unknown
  for (let attempt = 1; attempt <= retries; attempt++) {
    // 每个 attempt 都重新取令牌：429 冷却结束后重试也要排队，不能插队。
    await limiter.acquire()
    try {
      const res = await fetch(url, { ...init, headers })
      if (res.status === 429) {
        // 额度是整进程共享的：一条 429 就把整条队列一起冻结，其它并发请求
        // 不要接着撞（旧实现只让单条请求退避，同批并发照打 → 越退避越堵）。
        const wait =
          parseRetryAfter(res.headers.get('retry-after')) ||
          Math.min(2 ** attempt, 30)
        limiter.penalize(wait)
        console.warn(
          `⏳ Kungal API 429（第 ${attempt} 次）：全局冷却 ${wait}s，上限 ${kungalRatePerMin()} 次/分`,
        )
        lastError = new KungalApiError(
          429,
          'rate_limited',
          `Kungal API 触发限流（429），${wait}s 后重试`,
        )
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
          await sleep(500 * attempt)
          continue
        }
        throw new KungalApiError(
          res.status,
          problem?.code ?? null,
          problem?.detail,
        )
      }
      const text = await res.text()
      return (text ? JSON.parse(text) : {}) as T
    } catch (err) {
      if (err instanceof KungalApiError) throw err
      lastError = err
      if (attempt === retries) break
      await sleep(500 * attempt)
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Kungal API ${path} 重试 ${retries} 次仍失败`)
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
  /**
   * 每收一页回调一次；返回 true 立即停止翻页。
   *
   * 抽样脚本（只取几百条样本铺页面）用它提前收手：否则为了一个样本计划
   * 要把整站目录翻完，白花几十个请求。
   */
  onPage?: (
    rows: KungalWalkthroughIndexRow[],
    page: number,
  ) => boolean | undefined
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
    const rows = data.items ?? []
    out.push(...rows)
    if (options?.onPage?.(rows, page + 1) === true) return out
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
