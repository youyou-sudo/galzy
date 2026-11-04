import { type SQL, sql } from 'drizzle-orm'
import type {
  KungalCharacterItem,
  KungalWorkCharacter,
  KungalWorkItem,
} from './types'

/** refs 行：跨源精确锚点（source 小写，external_id 原样大小写）。 */
export interface KungalRef {
  source: string
  external_id: string
}

/** 别名对（形状对齐 @api/libs/identity 的 linkAliases 入参）。 */
export interface KungalAliasPair {
  kind: string
  externalId: string
  canonicalVid: string
}

/** 历史库里的 refs 是 "jsonb 里装 JSON 字符串"（双编码），先解一层再当数组用。 */
function unwrapJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

/**
 * refs 兼容读取：新行是真正的 jsonb 数组，历史行是 JSON 字符串（双编码）。
 * 返回规范化数组（source 小写、丢弃缺字段的行），永不返回 null。
 */
export function parseRefs(value: unknown): KungalRef[] {
  const raw = unwrapJson(value)
  if (!Array.isArray(raw)) return []
  const out: KungalRef[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const source = String((entry as { source?: unknown }).source ?? '')
      .trim()
      .toLowerCase()
    const externalId = String(
      (entry as { external_id?: unknown }).external_id ?? '',
    ).trim()
    if (!source || !externalId) continue
    out.push({ source, external_id: externalId })
  }
  return out
}

/**
 * refs → 外部锚点别名对（kungal/bangumi/dlsite/… → vndb）。
 * 跳过：vndb release 锚点 rNNN（不是作品）、超出 external_id 列宽（255）的 key。
 */
export function refsToAliasPairs(
  refs: KungalRef[],
  canonicalVid: string,
): KungalAliasPair[] {
  const pairs: KungalAliasPair[] = []
  for (const ref of refs) {
    if (ref.source === 'vndb' && /^r\d+$/i.test(ref.external_id)) continue
    if (ref.source.length > 32 || ref.external_id.length > 255) continue
    pairs.push({
      kind: ref.source,
      externalId: ref.external_id,
      canonicalVid,
    })
  }
  return pairs
}

/**
 * jsonb 数组写入表达式。
 *
 * 不能把数组直接交给 drizzle/bun：drizzle 会 JSON.stringify 成字符串参数，而 bun
 * 对 jsonb 参数再做一次 JSON 编码 → 列里落成 jsonb 字符串（历史 bug）。显式
 * `::text::jsonb` 让 PG 按 text 收参数、自己解析成数组，绕开二次编码。
 */
export function jsonbArray(value: unknown): SQL {
  const text = JSON.stringify(value ?? [])
  return sql`${text}::text::jsonb`
}

export interface KungalWorkRow {
  id: string
  vndbId: string | null
  olang: string | null
  medium: string | null
  contentRating: string | null
  releasedFirst: string | null
  displayName: string | null
  coverUrl: string | null
  coverWidth: number | null
  coverHeight: number | null
  coverThumbhash: string | null
  intro: string | null
  localized: unknown
  covers: unknown
  intros: unknown
  ratings: unknown
  refs: unknown
}

export interface KungalTitleRow {
  workId: string
  lang: string
  official: boolean | null
  title: string
  latin: string | null
  main: boolean | null
}

/**
 * refs → VNDB 作品锚点（source=vndb 且 external_id 形如 vNNN；release 锚点 rNNN 排除）。
 * 兼容历史双编码数据（见 parseRefs）。
 */
export function extractVndbRef(refs: unknown): string | null {
  const hit = parseRefs(refs).find(
    (r) => r.source === 'vndb' && /^v\d+$/i.test(r.external_id),
  )
  return hit?.external_id ?? null
}

/** cover/covers/banner 块 → 竖版封面（cover 优先，兜底 portrait_pinned / 首条 / banner）。 */
export function pickCover(item: KungalWorkItem): {
  url: string | null
  width: number | null
  height: number | null
  thumbhash: string | null
} {
  const use = (
    img?: {
      url?: string
      width?: number | null
      height?: number | null
      thumbhash?: string | null
    } | null,
  ) =>
    img?.url
      ? {
          url: img.url,
          width: img.width ?? null,
          height: img.height ?? null,
          thumbhash: img.thumbhash ?? null,
        }
      : null

  const cover = use(item.cover)
  if (cover) return cover

  const rows = item.covers ?? []
  const chosen =
    rows.find((c) => c.portrait_pinned) ?? rows.find((c) => c.url) ?? null
  if (chosen?.url) {
    return {
      url: chosen.url,
      width: chosen.width ?? null,
      height: chosen.height ?? null,
      thumbhash: chosen.thumbhash ?? null,
    }
  }

  const banner = use(item.banner)
  if (banner) return banner

  return { url: null, width: null, height: null, thumbhash: null }
}

/** intros 数组 → 最佳简介（zh-Hans → zh → en → 首条；v2 字段为 value）。 */
export function pickIntro(intros: unknown): string | null {
  if (!Array.isArray(intros)) return null
  const rows = intros as Array<{
    lang?: string
    value?: string
    intro?: string
  }>
  const text = (row: { lang?: string; value?: string; intro?: string }) =>
    row.value ?? row.intro
  const byLang = (lang: string) =>
    rows.find((i) => i.lang?.toLowerCase() === lang.toLowerCase())
  return (
    text(byLang('zh-Hans') ?? byLang('zh') ?? byLang('en') ?? rows[0] ?? {}) ??
    null
  )
}

/** 角色简介语言优先级：中文优先，其次日文原文，最后英文/首条。 */
const CHARACTER_INTRO_LANGS = ['zh-Hans', 'zh', 'ja', 'en']

/** 图片宽高等字段容错：只接受有限非负数，其余一律 null（上游可能给字符串）。 */
function intOrNull(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    return null
  return Math.trunc(value)
}

/** 非空字符串裁剪，空串归一为 null（避免展示层渲染空白）。 */
function textOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * localized 块 → { lang: 名称 } 的扁平 map。
 * kungal 的 localized 是 { lang: { value, is_machine } }，展示层只需要值；
 * 全空时返回 null，让前端能区分「没有多语言名」与「空对象」。
 */
export function normalizeLocalizedNames(
  raw: unknown,
): Record<string, string> | null {
  if (!raw || typeof raw !== 'object') return null
  const out: Record<string, string> = {}
  for (const [lang, entry] of Object.entries(
    raw as Record<string, { value?: unknown } | undefined>,
  )) {
    const value = textOrNull(entry?.value)
    if (value) out[lang] = value
  }
  return Object.keys(out).length > 0 ? out : null
}

/**
 * measurements 容错读取。
 *
 * 权威形状是 { bust_cm, waist_cm, hip_cm, cup }；这里同时接受 buster/waist/hip
 * 这类旧写法，避免上游改键名时整批角色同步失败。三围是整数、cup 是文本，
 * 缺失的键不写入结果（前端据此判断「没记录」）。
 */
export function normalizeMeasurements(
  raw: unknown,
): Record<string, number | string> | null {
  if (!raw || typeof raw !== 'object') return null
  const src = raw as Record<string, unknown>
  const out: Record<string, number | string> = {}
  const pick = (keys: string[]): number | null => {
    for (const key of keys) {
      const n = intOrNull(src[key])
      if (n !== null) return n
    }
    return null
  }
  const bust = pick(['bust_cm', 'bust'])
  const waist = pick(['waist_cm', 'waist'])
  const hip = pick(['hip_cm', 'hip'])
  const cup = textOrNull(src.cup)
  if (bust !== null) out.bust_cm = bust
  if (waist !== null) out.waist_cm = waist
  if (hip !== null) out.hip_cm = hip
  if (cup !== null) out.cup = cup
  return Object.keys(out).length > 0 ? out : null
}

/**
 * 角色图片选择：image 优先（裁剪后的立绘），没有 image 时退回 figure（全身图）。
 * 两者都是 kungal 的 Image 块，url 恒为绝对地址，不需要再拼 CDN 前缀。
 */
export function pickCharacterImage(item: {
  image?: {
    url?: string
    width?: number | null
    height?: number | null
    thumbhash?: string | null
  } | null
  figure?: {
    url?: string
    width?: number | null
    height?: number | null
    thumbhash?: string | null
  } | null
}): {
  url: string | null
  width: number | null
  height: number | null
  thumbhash: string | null
} {
  for (const img of [item.image, item.figure]) {
    const url = textOrNull(img?.url)
    if (!url) continue
    return {
      url,
      width: intOrNull(img?.width),
      height: intOrNull(img?.height),
      thumbhash: textOrNull(img?.thumbhash),
    }
  }
  return { url: null, width: null, height: null, thumbhash: null }
}

/** 角色简介：从 intros 里按语言优先级取第一条。 */
export function pickCharacterIntro(intros: unknown): string | null {
  if (!Array.isArray(intros)) return null
  const rows = intros as Array<{ lang?: string; value?: string }>
  for (const lang of CHARACTER_INTRO_LANGS) {
    const hit = rows.find(
      (row) =>
        row.lang?.toLowerCase() === lang.toLowerCase() && textOrNull(row.value),
    )
    if (hit) return textOrNull(hit.value)
  }
  for (const row of rows) {
    const value = textOrNull(row.value)
    if (value) return value
  }
  return null
}

/** kungalCharacters 行（不含 syncedAt，由同步侧统一补时间戳）。 */
export interface KungalCharacterRow {
  id: string
  displayName: string
  latin: string | null
  lang: string | null
  localized: unknown
  gender: string | null
  birthday: string | null
  bloodType: string | null
  heightCm: number | null
  weightKg: number | null
  measurements: unknown
  imageUrl: string | null
  imageWidth: number | null
  imageHeight: number | null
  imageThumbhash: string | null
  image: unknown
  figure: unknown
  intro: string | null
  intros: unknown
  instanceOfId: string | null
  traits: unknown
  refs: unknown
}

/** kungalCharacterAppearances 行（不含 syncedAt）。 */
export interface KungalAppearanceRow {
  characterId: string
  workId: string
  rosterRole: string | null
  spoiler: string | null
  sortOrder: number | null
}

/**
 * Character（view=full + include）行 → kungalCharacters 行。
 *
 * 图片插槽取 image 优先、figure 兜底；traits/refs/intros 原样保留 jsonb
 * （traits 不做词表合并，见 schema 注释）。
 */
export function normalizeCharacter(
  item: KungalCharacterItem,
): KungalCharacterRow {
  const image = pickCharacterImage(item)
  return {
    id: String(item.id),
    displayName: item.display_name?.trim() ?? '',
    latin: textOrNull(item.latin),
    lang: textOrNull(item.lang),
    localized: item.localized ?? null,
    gender: textOrNull(item.gender),
    birthday: textOrNull(item.birthday),
    bloodType: textOrNull(item.blood_type),
    heightCm: intOrNull(item.height_cm),
    weightKg: intOrNull(item.weight_kg),
    measurements: normalizeMeasurements(item.measurements),
    imageUrl: image.url,
    imageWidth: image.width,
    imageHeight: image.height,
    imageThumbhash: image.thumbhash,
    image: item.image ?? null,
    figure: item.figure ?? null,
    intro: pickCharacterIntro(item.intros),
    intros: item.intros ?? null,
    instanceOfId: textOrNull(item.instance_of_id),
    traits: item.traits ?? null,
    refs: parseRefs(item.refs),
  }
}

/**
 * 名册行（WorkCharacter）→ 最小 kungalCharacters 行。
 *
 * 用途：ids= 水合对少数 id 未命中时（被隐藏/删除/NSFW 门差异）仍要把作品
 * 名册落库 —— appearances 有指向 characters 的外键，缺主行会整批 23503。
 * 资料字段留空，等下一次同步水合补齐；展示名/图片名册里本来就有。
 */
export function normalizeCharacterFromRoster(
  item: KungalWorkCharacter,
): KungalCharacterRow {
  const image = pickCharacterImage(item)
  return {
    id: String(item.id),
    displayName: item.display_name?.trim() ?? '',
    latin: textOrNull(item.latin),
    lang: null,
    localized: item.localized ?? null,
    gender: null,
    birthday: null,
    bloodType: null,
    heightCm: null,
    weightKg: null,
    measurements: null,
    imageUrl: image.url,
    imageWidth: image.width,
    imageHeight: image.height,
    imageThumbhash: image.thumbhash,
    image: item.image ?? null,
    figure: item.figure ?? null,
    intro: null,
    intros: null,
    instanceOfId: null,
    traits: null,
    refs: null,
  }
}

/** 名册行 → appearances 行（roster_role/spoiler 只存在于名册，不在水合行里）。 */
export function normalizeAppearance(
  workId: string,
  item: KungalWorkCharacter,
  sortOrder: number,
): KungalAppearanceRow {
  return {
    characterId: String(item.id),
    workId,
    rosterRole: textOrNull(item.roster_role),
    spoiler: textOrNull(item.spoiler),
    sortOrder,
  }
}

/** works-list 行 → kungalWorks 行 + kungalWorkTitles 行（形状对齐 vn_titles）。 */
export function normalizeWork(
  item: KungalWorkItem,
  resolvedVid: string | null,
): { work: KungalWorkRow; titles: KungalTitleRow[] } {
  const id = String(item.id)
  const olang = item.olang ?? null
  const vndbId = resolvedVid ?? extractVndbRef(item.refs)
  const localized = item.localized ?? null
  const cover = pickCover(item)
  const intro = pickIntro(item.intros)

  const titles: KungalTitleRow[] = []
  if (localized && typeof localized === 'object') {
    for (const [lang, t] of Object.entries(localized)) {
      const value = t?.value?.trim()
      if (!value) continue
      titles.push({
        workId: id,
        lang,
        official: t.kind === 'official',
        title: value,
        latin: null,
        main: lang === olang,
      })
    }
  }

  return {
    work: {
      id,
      vndbId,
      olang,
      medium: item.medium ?? null,
      contentRating: item.content_rating ?? null,
      releasedFirst: item.release_date ?? null,
      displayName: item.display_name ?? null,
      coverUrl: cover.url,
      coverWidth: cover.width,
      coverHeight: cover.height,
      coverThumbhash: cover.thumbhash,
      intro,
      localized,
      covers: item.covers ?? null,
      intros: item.intros ?? null,
      ratings: item.ratings ?? null,
      // refs 统一落成真正的 jsonb 数组（写库时再经 jsonbArray 绕开驱动二次编码）。
      refs: parseRefs(item.refs),
    },
    titles,
  }
}
