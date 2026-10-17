import { type SQL, sql } from 'drizzle-orm'
import type { KungalWorkItem } from './types'

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
