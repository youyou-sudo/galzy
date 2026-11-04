import { alistb, db, kungalWalkthroughs, kungalWorks, sql } from '@api/libs'
import { displayIdWhere, resolveDisplayId } from '@api/libs/identity'
import type {
  KungalLocalizedMap,
  KungalWalkthroughChart,
} from '@api/libs/kungal-api'
import { eq } from 'drizzle-orm'
import { status } from 'elysia'

/* ────────────────────────────── DTO（与前端约定） ────────────────────────────── */

/**
 * 攻略摘要（列表项）。
 *
 * 字段名是 camelCase 且**不得删改**：web 侧 BFF 与组件按这些键直接渲染。
 * 所有「上游可能没有」的字段一律显式 null（不省略键），前端不必到处兜底
 * undefined。
 */
export interface WalkthroughReleaseDTO {
  id: string
  title: string | null
  lang: string | null
  /** default | digital | physical | trial | patch（patch 含汉化补丁） */
  releaseKind: string | null
  /** 发行/补丁组名（展示用，不当判别字段） */
  companies: string[]
}

/**
 * chart 里引用的角色（key → 目录角色）。
 * localized 是 { BCP-47: { value, is_machine } }，**不是**字符串 map：
 * 上游给的是机器翻译块，is_machine 要透传出去（前端决定要不要标注）。
 */
export interface WalkthroughCharacterDTO {
  key: string
  /** 原页面写法的人名（可能带记号，如 "雪乃"）；展示优先用 displayName */
  name: string
  /** 目录角色 id；未钉到目录角色时为 null */
  characterId: string | null
  /** 钉住的目录角色主显示名；characterId 为 null 时它也一定是 null */
  displayName: string | null
  localized: KungalLocalizedMap
}

export interface WalkthroughSummaryDTO {
  id: string
  workId: string
  /** 攻略正文语言（BCP-47）；localized 里不会出现这一种语言 */
  lang: string | null
  /** 开放词汇的来源站名，或 'nextmoe'（平台自写）。**不能**当判别字段 */
  source: string | null
  /** 原页面地址（署名外链）；平台自写的攻略为 null */
  sourceUrl: string | null
  sourceAuthor: string | null
  /** 原页面自称的更新日期（YYYY-MM-DD 日期串，不是时间戳） */
  sourceUpdatedOn: string | null
  /** 作品展示轴：sfw | nsfw（与年龄轴 nsfw 参数无关） */
  workContentLimit: string | null
  /** 游戏自带路线提示：为 true 时前端应先说明「游戏本身就有提示」 */
  workRouteHints: boolean | null
  release: WalkthroughReleaseDTO | null
  characters: WalkthroughCharacterDTO[]
  endingCount: number | null
  saveCount: number | null
  segmentCount: number | null
  /** 上游最后更新时间（ISO 串），列表按它倒序 */
  upstreamUpdatedAt: string | null
}

/**
 * 攻略详情 = 摘要 + chart。
 *
 * ⚠️ chart 内部**完全保持上游 snake_case 原样**（step_type / from_node /
 * to_node / character_keys / save_key / remark_localized …），不做任何改名、
 * 不裁字段。原因：chart 是整块 jsonb 透传（见 db/schema/kungal.ts 的
 * galrc_kungal_walkthroughs 注释），前端按公开 API 的 snake_case 名字消费；
 * 若这里再翻译一层，上游新增字段每次都要跟着改两处代码。
 *
 * chart 可能为 null：上一次同步只拿到了列表行、详情请求失败时，库里保留的是
 * 旧 chart 或空 chart。前端必须能渲染「这条攻略的流程图暂时不可用」。
 */
export interface WalkthroughDetailDTO extends WalkthroughSummaryDTO {
  chart: KungalWalkthroughChart | null
}

/** GET /walkthroughs/game 响应。 */
export interface GameWalkthroughsResult {
  gameId: string
  /** 命中的 kungal work id；空数组时可能为 null（该条目没有目录作品） */
  workId: string | null
  items: WalkthroughSummaryDTO[]
}

/* ─────────────────────────────── 读侧容错 ─────────────────────────────── */

/**
 * 兼容历史/异常行：jsonb 列里可能落的是「jsonb 装 JSON 字符串」（驱动二次
 * 编码的历史 bug）。读侧先解一层再解析；解不开就当没有（null），不让坏行
 * 变成空白展示。写侧已统一走显式 text→jsonb（见 kungal-sync 的
 * jsonbTextOrNull），这里只是兜底。
 */
function unwrapJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

/** localized 块 → 原样保留每格 { value, is_machine }；坏行归一为空对象。 */
function localizedMapOf(raw: unknown): KungalLocalizedMap {
  const block = unwrapJson(raw)
  if (!block || typeof block !== 'object' || Array.isArray(block)) return {}
  const out: KungalLocalizedMap = {}
  for (const [lang, entry] of Object.entries(
    block as Record<string, unknown>,
  )) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    out[lang] = entry as KungalLocalizedMap[string]
  }
  return out
}

/** WalkthroughRelease 原始块 → DTO（release_kind 是唯一需要改名的字段）。 */
function releaseOf(raw: unknown): WalkthroughReleaseDTO | null {
  const block = unwrapJson(raw)
  if (!block || typeof block !== 'object' || Array.isArray(block)) return null
  const src = block as Record<string, unknown>
  const id = typeof src.id === 'string' ? src.id : ''
  // id 是 release 的目录 id，没有它这块就没有外链价值，整块丢弃
  if (!id) return null
  return {
    id,
    title: typeof src.title === 'string' ? src.title : null,
    lang: typeof src.lang === 'string' ? src.lang : null,
    releaseKind: typeof src.release_kind === 'string' ? src.release_kind : null,
    companies: Array.isArray(src.companies)
      ? src.companies.filter((c): c is string => typeof c === 'string')
      : [],
  }
}

/** characters 原始数组 → DTO（只映射展示需要的字段；顺序即 chart 顺序）。 */
function charactersOf(raw: unknown): WalkthroughCharacterDTO[] {
  const list = unwrapJson(raw)
  if (!Array.isArray(list)) return []
  const out: WalkthroughCharacterDTO[] = []
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    const key = typeof row.key === 'string' ? row.key : ''
    // key 是 chart 内部的引用键（section.character_keys 指过来），没有就整条丢弃
    if (!key) continue
    out.push({
      key,
      name: typeof row.name === 'string' ? row.name : '',
      characterId:
        typeof row.character_id === 'string' ? row.character_id : null,
      displayName:
        typeof row.display_name === 'string' ? row.display_name : null,
      localized: localizedMapOf(row.localized),
    })
  }
  return out
}

/**
 * chart 原始块 → 透传对象。
 *
 * 只做两件事：① 解掉历史双编码；② 把六个承诺「恒为数组」的顶层键兜成数组
 * （坏数据下前端可以无条件 .map）。其余键（包括上游以后新增的）原样保留 ——
 * 这正是整块 jsonb 透传的意义。
 */
function chartOf(raw: unknown): KungalWalkthroughChart | null {
  const block = unwrapJson(raw)
  if (!block || typeof block !== 'object' || Array.isArray(block)) return null
  const chart = block as Record<string, unknown>
  const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
  return {
    ...chart,
    sections: arr(chart.sections),
    segments: arr(chart.segments),
    entries: arr(chart.entries),
    endings: arr(chart.endings),
    saves: arr(chart.saves),
    legend: arr(chart.legend),
  } as unknown as KungalWalkthroughChart
}

/* ─────────────────────────────── 查询实现 ─────────────────────────────── */

/**
 * 列表查询只取这些列：**不取 chart**。
 * chart 单行可达几十 KB，作品页一次要列该作品全部攻略，带上 chart 会让
 * 一次列表请求变成几百 KB 的 JSON —— 摘要只需要标量 + 计数 + 角色表。
 */
const summaryColumns = {
  id: kungalWalkthroughs.id,
  workId: kungalWalkthroughs.workId,
  lang: kungalWalkthroughs.lang,
  source: kungalWalkthroughs.source,
  sourceUrl: kungalWalkthroughs.sourceUrl,
  sourceAuthor: kungalWalkthroughs.sourceAuthor,
  sourceUpdatedOn: kungalWalkthroughs.sourceUpdatedOn,
  workContentLimit: kungalWalkthroughs.workContentLimit,
  workRouteHints: kungalWalkthroughs.workRouteHints,
  release: kungalWalkthroughs.release,
  characters: kungalWalkthroughs.characters,
  endingCount: kungalWalkthroughs.endingCount,
  saveCount: kungalWalkthroughs.saveCount,
  segmentCount: kungalWalkthroughs.segmentCount,
  upstreamUpdatedAt: kungalWalkthroughs.upstreamUpdatedAt,
}

type SummaryRow = {
  [K in keyof typeof summaryColumns]: unknown
}

/** 行 → 摘要 DTO（时间统一转 ISO 串：Eden 侧类型与运行时都按字符串对齐）。 */
function toSummaryDTO(row: SummaryRow): WalkthroughSummaryDTO {
  return {
    id: String(row.id),
    workId: String(row.workId),
    lang: (row.lang as string | null) ?? null,
    source: (row.source as string | null) ?? null,
    sourceUrl: (row.sourceUrl as string | null) ?? null,
    sourceAuthor: (row.sourceAuthor as string | null) ?? null,
    sourceUpdatedOn: (row.sourceUpdatedOn as string | null) ?? null,
    workContentLimit: (row.workContentLimit as string | null) ?? null,
    workRouteHints: (row.workRouteHints as boolean | null) ?? null,
    release: releaseOf(row.release),
    characters: charactersOf(row.characters),
    endingCount: (row.endingCount as number | null) ?? null,
    saveCount: (row.saveCount as number | null) ?? null,
    segmentCount: (row.segmentCount as number | null) ?? null,
    upstreamUpdatedAt:
      (row.upstreamUpdatedAt as Date | null)?.toISOString() ?? null,
  }
}

/**
 * 展示身份 → kungal work 行。
 *
 * 两条命中路径都要走：① vndb 锚点（正常作品，vndb_id 唯一索引）
 * ② kungal work id（kungal-only 条目没有 vndb 锚点，历史 /kgX 链接也要能看）。
 */
async function findWork(
  lookupVid: string | null,
  lookupKungalId: string | null,
): Promise<{ id: string; vndbId: string | null } | undefined> {
  if (lookupVid) {
    const hit = await db
      .select({ id: kungalWorks.id, vndbId: kungalWorks.vndbId })
      .from(kungalWorks)
      .where(eq(kungalWorks.vndbId, lookupVid))
      .limit(1)
      .then((rows) => rows[0])
    if (hit) return hit
  }
  if (lookupKungalId) {
    // kungal work id 大小写敏感，但 URL 里的大小写不可控，按 lower 匹配
    const hit = await db
      .select({ id: kungalWorks.id, vndbId: kungalWorks.vndbId })
      .from(kungalWorks)
      .where(sql`lower(${kungalWorks.id}) = lower(${lookupKungalId})`)
      .limit(1)
      .then((rows) => rows[0])
    if (hit) return hit
  }
  return undefined
}

export const Walkthrough = {
  /**
   * GET /walkthroughs/game?gameId=vNNN|kgX
   *
   * 作品不存在 / 作品没有攻略都返回空数组而不是 404：条目页的「攻略」页签
   * 在攻略还没同步、或该作品确实没有攻略时都要能渲染空态。
   */
  async Game({ gameId }: { gameId: string }): Promise<GameWalkthroughsResult> {
    const raw = gameId?.trim()
    // 展示身份统一口径：旧 kgX 链接可能已升级成 vNNN（走别名表归一）
    const canonicalId = raw ? ((await resolveDisplayId(raw)) ?? raw) : ''
    if (!canonicalId) return { gameId: '', workId: null, items: [] }

    const anchor = await db
      .select({ vid: alistb.vid, kungalId: alistb.kungalId })
      .from(alistb)
      .where(displayIdWhere(canonicalId))
      .limit(1)
      .then((rows) => rows[0])

    const isKungalRoute = canonicalId.toLowerCase().startsWith('kg')
    const lookupVid =
      anchor?.vid ??
      (/^v\d+$/i.test(canonicalId) ? canonicalId.toLowerCase() : null)
    const lookupKungalId =
      anchor?.kungalId ?? (isKungalRoute ? canonicalId.slice(2) : null)

    const work = await findWork(lookupVid, lookupKungalId)
    if (!work) return { gameId: canonicalId, workId: null, items: [] }

    const rows = await db
      .select(summaryColumns)
      .from(kungalWalkthroughs)
      .where(eq(kungalWalkthroughs.workId, work.id))
      // 上游更新时间倒序（同一天更新的按 id 兜底，保证顺序稳定可缓存）；
      // NULLS LAST 让「没有 upstream 时间」的历史行沉底，不至于顶掉新攻略。
      .orderBy(
        sql`${kungalWalkthroughs.upstreamUpdatedAt} DESC NULLS LAST`,
        kungalWalkthroughs.id,
      )

    return {
      gameId: canonicalId,
      workId: work.id,
      items: rows.map(toSummaryDTO),
    }
  },

  /**
   * GET /walkthroughs/info?id=<walkthroughId>
   *
   * 详情才读 chart（整块透传）。找不到 / 形态非法一律 404：攻略 id 是十进制
   * 字符串，非数字形态直接不查库。
   */
  async Info({ id }: { id: string }): Promise<WalkthroughDetailDTO> {
    const walkthroughId = id?.trim()
    if (!walkthroughId || !/^\d+$/.test(walkthroughId)) {
      throw status(404, `未找到 id=${id} 对应的攻略`)
    }

    const row = await db
      .select({ ...summaryColumns, chart: kungalWalkthroughs.chart })
      .from(kungalWalkthroughs)
      .where(eq(kungalWalkthroughs.id, walkthroughId))
      .limit(1)
      .then((rows) => rows[0])
    if (!row) throw status(404, `未找到 id=${id} 对应的攻略`)

    return {
      ...toSummaryDTO(row),
      chart: chartOf(row.chart),
    }
  },
}
