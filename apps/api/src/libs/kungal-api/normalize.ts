import type { KungalWorkItem } from './types'

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

/** refs 数组 → VNDB 作品锚点（source=vndb 且 external_id 形如 vNNN；release 锚点 rNNN 排除）。 */
export function extractVndbRef(refs: unknown): string | null {
  if (!Array.isArray(refs)) return null
  const hit = refs.find(
    (r) =>
      (r as { source?: string }).source === 'vndb' &&
      /^v\d+$/i.test((r as { external_id?: string }).external_id ?? ''),
  )
  return (hit as { external_id?: string } | undefined)?.external_id ?? null
}

/** covers 块 → 竖版封面（portrait 优先，兜底 banner）。 */
export function pickCover(covers: unknown): {
  url: string | null
  width: number | null
  height: number | null
} {
  const c = covers as {
    portrait?: { url?: string; width?: number; height?: number }
    banner?: { url?: string; width?: number; height?: number }
  } | null
  const portrait = c?.portrait
  if (portrait?.url) {
    return {
      url: portrait.url,
      width: portrait.width ?? null,
      height: portrait.height ?? null,
    }
  }
  const banner = c?.banner
  if (banner?.url) {
    return {
      url: banner.url,
      width: banner.width ?? null,
      height: banner.height ?? null,
    }
  }
  return { url: null, width: null, height: null }
}

/** intros 数组 → 最佳简介（zh-Hans → zh → en → 首条）。 */
export function pickIntro(intros: unknown): string | null {
  if (!Array.isArray(intros)) return null
  const rows = intros as Array<{ lang?: string; intro?: string }>
  const byLang = (lang: string) =>
    rows.find((i) => i.lang?.toLowerCase() === lang.toLowerCase())?.intro
  return (
    byLang('zh-Hans') ?? byLang('zh') ?? byLang('en') ?? rows[0]?.intro ?? null
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
  const cover = pickCover(item.covers)
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
      intro,
      localized,
      covers: item.covers ?? null,
      intros: item.intros ?? null,
      ratings: item.ratings ?? null,
      refs: item.refs ?? null,
    },
    titles,
  }
}
