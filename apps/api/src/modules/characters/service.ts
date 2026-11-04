import {
  alistb,
  db,
  kungalCharacterAppearances,
  kungalCharacters,
  kungalWorks,
  sql,
} from '@api/libs'
import {
  displayIdOf,
  displayIdWhere,
  resolveDisplayId,
} from '@api/libs/identity'
import { eq } from 'drizzle-orm'
import { status } from 'elysia'

/**
 * 前后端共用的角色契约（CharacterDTO）。
 *
 * 字段名与 web 侧 BFF 约定为 camelCase 且**不得删改**：前端按这些键直接渲染。
 * 所有「上游可能没有」的字段一律显式 null（不省略键），避免前端到处兜底 undefined。
 */
export interface CharacterTraitDTO {
  id?: string
  displayName?: string
  /** 中文名：行内 trait 只在 localized['zh-Hans'] 里，没有 name_zh 字段 */
  nameZh?: string
  isSexual?: boolean
  /** 根分组名（如 "Hair"），根 trait 自身为 null */
  group?: string | null
}

/**
 * 三围：kungal 的 measurements 是 { bust_cm, waist_cm, hip_cm, cup }，
 * 这里改成 camelCase 并只保留有值的键；全空时整个对象为 null。
 */
export interface CharacterMeasurementsDTO {
  bustCm?: number
  waistCm?: number
  hipCm?: number
  cup?: string
}

export interface CharacterDTO {
  id: string
  name: string
  latin: string | null
  /** { lang: 名称 } 扁平 map；无多语言名时为 null */
  localized: Record<string, string> | null
  gender: string | null
  /** MM-DD（无年份） */
  birthday: string | null
  bloodType: string | null
  heightCm: number | null
  weightKg: number | null
  measurements: CharacterMeasurementsDTO | null
  imageUrl: string | null
  imageWidth: number | null
  imageHeight: number | null
  imageThumbhash: string | null
  intro: string | null
  /** 原始 kungal trait 映射（不合并词表，可能为 null） */
  traits: CharacterTraitDTO[] | null
  rosterRole: string | null
  spoiler: string | null
}

/** 角色在某部作品里的出场（作品身份用展示身份口径，不外链 vndb） */
export interface CharacterAppearanceDTO {
  workId: string
  displayId: string
  displayName: string | null
  rosterRole: string | null
  spoiler: string | null
}

/** GET /characters/game 响应 */
export interface GameCharactersResult {
  gameId: string
  workId: string | null
  characters: CharacterDTO[]
}

/** GET /characters/info 响应 */
export interface CharacterInfoResult extends CharacterDTO {
  appearances: CharacterAppearanceDTO[]
}

/** 角色主表里查询接口需要的列（不含 traits 之外的原始块，减小响应前的内存占用）。 */
const characterColumns = {
  id: kungalCharacters.id,
  displayName: kungalCharacters.displayName,
  latin: kungalCharacters.latin,
  localized: kungalCharacters.localized,
  gender: kungalCharacters.gender,
  birthday: kungalCharacters.birthday,
  bloodType: kungalCharacters.bloodType,
  heightCm: kungalCharacters.heightCm,
  weightKg: kungalCharacters.weightKg,
  measurements: kungalCharacters.measurements,
  imageUrl: kungalCharacters.imageUrl,
  imageWidth: kungalCharacters.imageWidth,
  imageHeight: kungalCharacters.imageHeight,
  imageThumbhash: kungalCharacters.imageThumbhash,
  intro: kungalCharacters.intro,
  traits: kungalCharacters.traits,
}

type CharacterRow = {
  [K in keyof typeof characterColumns]: unknown
}

/** 名册排序权重：main → secondary → appears → unknown（未知取值排最后）。 */
const ROSTER_RANK = sql`CASE ${kungalCharacterAppearances.rosterRole}
  WHEN 'main' THEN 0
  WHEN 'secondary' THEN 1
  WHEN 'appears' THEN 2
  ELSE 3
END`

/**
 * 兼容历史/异常行：jsonb 列里可能落的是「jsonb 装 JSON 字符串」（驱动二次
 * 编码的历史 bug）。读侧先解一层再解析；解不开就当没有（null），不让坏行
 * 变成 NaN / 空白展示。写侧已统一走显式 text→jsonb（见 kungal-sync 的
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

/**
 * localized 原始块 → { lang: 名称 }，空值/空块归一为 null。
 *
 * 读侧统一先 unwrapJson：历史行可能是「jsonb 里装 JSON 字符串」，不解一层会
 * 把整个 localized 静默丢掉（与 refs 的历史双编码同一个坑）。
 */
function localizedOf(raw: unknown): Record<string, string> | null {
  const block = unwrapJson(raw)
  if (!block || typeof block !== 'object') return null
  const out: Record<string, string> = {}
  for (const [lang, entry] of Object.entries(
    block as Record<string, { value?: unknown } | undefined>,
  )) {
    const value = typeof entry?.value === 'string' ? entry.value.trim() : ''
    if (value) out[lang] = value
  }
  return Object.keys(out).length > 0 ? out : null
}

/** measurements 原始 jsonb → DTO（只保留有值的键，容忍缺少/类型异常）。 */
function measurementsOf(raw: unknown): CharacterMeasurementsDTO | null {
  const value = unwrapJson(raw)
  if (!value || typeof value !== 'object') return null
  const src = value as Record<string, unknown>
  const int = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0
      ? Math.trunc(value)
      : undefined
  const out: CharacterMeasurementsDTO = {}
  const bust = int(src.bust_cm ?? src.bust)
  const waist = int(src.waist_cm ?? src.waist)
  const hip = int(src.hip_cm ?? src.hip)
  const cup = typeof src.cup === 'string' ? src.cup.trim() : ''
  if (bust !== undefined) out.bustCm = bust
  if (waist !== undefined) out.waistCm = waist
  if (hip !== undefined) out.hipCm = hip
  if (cup) out.cup = cup
  return Object.keys(out).length > 0 ? out : null
}

/** 原始 CharacterTrait 数组 → DTO（只映射展示需要的字段）。 */
function traitsOf(raw: unknown): CharacterTraitDTO[] | null {
  // 历史脏行可能是 JSON 字符串：不解一层 Array.isArray 为 false，traits 会静默全丢
  const list = unwrapJson(raw)
  if (!Array.isArray(list)) return null
  const out: CharacterTraitDTO[] = []
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue
    const trait = entry as Record<string, unknown>
    const id = typeof trait.id === 'string' ? trait.id : undefined
    const displayName =
      typeof trait.display_name === 'string' ? trait.display_name : undefined
    // 行内 CharacterTrait 没有 name_zh（那是目录 /catalog/traits 的 Trait 字段），
    // 中文名只在 localized['zh-Hans'].value 里；两个位置都读，兼容上游加键。
    const localizedZh = (
      trait.localized as
        | Record<string, { value?: unknown } | undefined>
        | undefined
    )?.['zh-Hans']?.value
    const rawNameZh =
      typeof trait.name_zh === 'string' && trait.name_zh.trim()
        ? trait.name_zh.trim()
        : typeof localizedZh === 'string'
          ? localizedZh.trim()
          : ''
    // 取不到中文就退回主显示名（前端只有 nameZh 一个中文槽位）
    const nameZh = rawNameZh || displayName || undefined
    const isSexual =
      typeof trait.is_sexual === 'boolean' ? trait.is_sexual : undefined
    const group = typeof trait.group === 'string' ? trait.group : null
    // 四项全空的行没有展示价值，直接丢掉（上游给空对象的情况见过）
    if (!id && !displayName && !nameZh) continue
    out.push({ id, displayName, nameZh, isSexual, group })
  }
  return out.length > 0 ? out : null
}

/** 主表行 + 名册字段 → CharacterDTO。 */
function toCharacterDTO(
  row: CharacterRow,
  rosterRole: string | null,
  spoiler: string | null,
): CharacterDTO {
  return {
    id: String(row.id),
    name: String(row.displayName ?? ''),
    latin: (row.latin as string | null) ?? null,
    localized: localizedOf(row.localized),
    gender: (row.gender as string | null) ?? null,
    birthday: (row.birthday as string | null) ?? null,
    bloodType: (row.bloodType as string | null) ?? null,
    heightCm: (row.heightCm as number | null) ?? null,
    weightKg: (row.weightKg as number | null) ?? null,
    measurements: measurementsOf(row.measurements),
    imageUrl: (row.imageUrl as string | null) ?? null,
    imageWidth: (row.imageWidth as number | null) ?? null,
    imageHeight: (row.imageHeight as number | null) ?? null,
    imageThumbhash: (row.imageThumbhash as string | null) ?? null,
    intro: (row.intro as string | null) ?? null,
    traits: traitsOf(row.traits),
    rosterRole,
    spoiler,
  }
}

/**
 * 展示身份 → kungal work 行。
 *
 * 两种命中路径都要走：① vndb 锚点（正常作品，vndb_id 唯一索引）
 * ② kungal work id（kungal-only 条目没有 vndb 锚点，历史 /kgX 链接也要能看角色）。
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

export const Character = {
  /**
   * GET /characters/game?gameId=vNNN|kgX
   *
   * 无作品/无角色都返回空数组而不是 404：条目页的「详情」页签在角色还没同步
   * 或该作品确实没有角色时都要能正常渲染空态。
   */
  async Game({ gameId }: { gameId: string }): Promise<GameCharactersResult> {
    const raw = gameId?.trim()
    // 展示身份统一口径：旧 kgX 链接可能已升级成 vNNN（走别名表归一）
    const canonicalId = raw ? ((await resolveDisplayId(raw)) ?? raw) : ''
    if (!canonicalId) return { gameId: '', workId: null, characters: [] }

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
    if (!work) return { gameId: canonicalId, workId: null, characters: [] }

    const rows = await db
      .select({
        ...characterColumns,
        rosterRole: kungalCharacterAppearances.rosterRole,
        spoiler: kungalCharacterAppearances.spoiler,
      })
      .from(kungalCharacterAppearances)
      .innerJoin(
        kungalCharacters,
        eq(kungalCharacters.id, kungalCharacterAppearances.characterId),
      )
      .where(eq(kungalCharacterAppearances.workId, work.id))
      .orderBy(
        ROSTER_RANK,
        // 同档内按上游名册顺序，再按 id 兜底，保证分页/渲染顺序稳定
        sql`${kungalCharacterAppearances.sortOrder} NULLS LAST`,
        kungalCharacterAppearances.characterId,
      )

    return {
      gameId: canonicalId,
      workId: work.id,
      characters: rows.map((row) =>
        toCharacterDTO(row, row.rosterRole, row.spoiler),
      ),
    }
  },

  /**
   * GET /characters/info?id=<characterId>
   *
   * DTO 里的 rosterRole/spoiler 取「最强的一次出场」（排序规则同作品名册），
   * 因为同一个角色可能横跨多部作品、戏份档位不同。完整列表在 appearances。
   */
  async Info({ id }: { id: string }): Promise<CharacterInfoResult> {
    const characterId = id?.trim()
    // kungal character id 是十进制字符串；非法形态直接 404，不查库
    if (!characterId || !/^\d+$/.test(characterId)) {
      throw status(404, `未找到 id=${id} 对应的角色`)
    }

    const row = await db
      .select(characterColumns)
      .from(kungalCharacters)
      .where(eq(kungalCharacters.id, characterId))
      .limit(1)
      .then((rows) => rows[0])
    if (!row) throw status(404, `未找到 id=${id} 对应的角色`)

    const appearances = await db
      .select({
        workId: kungalWorks.id,
        vndbId: kungalWorks.vndbId,
        displayName: kungalWorks.displayName,
        rosterRole: kungalCharacterAppearances.rosterRole,
        spoiler: kungalCharacterAppearances.spoiler,
      })
      .from(kungalCharacterAppearances)
      .innerJoin(
        kungalWorks,
        eq(kungalWorks.id, kungalCharacterAppearances.workId),
      )
      .where(eq(kungalCharacterAppearances.characterId, characterId))
      .orderBy(
        ROSTER_RANK,
        sql`${kungalCharacterAppearances.sortOrder} NULLS LAST`,
        kungalCharacterAppearances.workId,
      )

    const mapped: CharacterAppearanceDTO[] = appearances.map((row) => ({
      workId: row.workId,
      // 展示身份：有 vndb 锚点 → vNNN，否则 kgX（不外链 vndb）
      displayId: displayIdOf('kungal', row.workId, row.vndbId),
      displayName: row.displayName,
      rosterRole: row.rosterRole,
      spoiler: row.spoiler,
    }))
    const primary = mapped[0] ?? null
    return {
      ...toCharacterDTO(
        row,
        primary?.rosterRole ?? null,
        primary?.spoiler ?? null,
      ),
      appearances: mapped,
    }
  },
}
