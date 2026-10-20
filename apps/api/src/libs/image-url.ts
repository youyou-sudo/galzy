const VNDB_IMAGE_HOST = 'https://vndb-t.galzy.moe'
const VNDB_LEGACY_HOST = 'https://t.vndb.org'

export type CoverDimensions = {
  url?: string | null
  width?: number | null
  height?: number | null
}

/** Configured base URL for game cover images (env: GAME_IMAGE_BASE_URL). */
const baseUrl = process.env.GAME_IMAGE_BASE_URL || VNDB_IMAGE_HOST

/**
 * Build a VNDB-style cover image URL from the image ID using the configured
 * base URL. Images larger than 256x400 use the `.t` thumbnail variant,
 * matching the VNDB CDN path convention.
 */
export function buildCoverUrl(
  imageId: string,
  width?: number | null,
  height?: number | null,
): string {
  const prefix = imageId.slice(0, 2)
  const suffix = imageId.slice(-2)
  const body = imageId.slice(2)
  const isLarge = (width ?? 0) > 256 && (height ?? 0) > 400
  const sizePath = isLarge ? `${prefix}.t` : prefix
  return `${baseUrl}/${sizePath}/${suffix}/${body}.jpg`
}

/** 具备可用尺寸的封面（type guard：收窄后宽高恒为非空 number）。 */
export type UsableCover = CoverDimensions & {
  url: string
  width: number
  height: number
}

/** 封面是否具备可用尺寸（任意方向：只要求 url + 正整数宽高）。 */
export function hasUsableCover(
  cover: CoverDimensions | null | undefined,
): cover is UsableCover {
  return (
    typeof cover?.url === 'string' &&
    cover.url.length > 0 &&
    typeof cover.width === 'number' &&
    Number.isFinite(cover.width) &&
    cover.width > 0 &&
    typeof cover.height === 'number' &&
    Number.isFinite(cover.height) &&
    cover.height > 0
  )
}

/** Only use a source cover when it has safe, portrait dimensions. */
export function hasUsablePortraitCover(
  cover: CoverDimensions | null | undefined,
): boolean {
  return hasUsableCover(cover) && cover.height >= cover.width
}

/**
 * 是否用 kungal 封面覆盖当前展示的图片。
 *
 * 优先级：竖版 kungal 封面 > 现有图（通常是 VNDB）> 横版 kungal 封面。
 *
 * 竖版门控保留原有意图 —— 横版素材多为截图/横幅/同人图，有 VNDB 正式封面时
 * 不该拿它顶上。但 kungal-only 条目（以及 vn 没有 c_image 的作品）本来就没有
 * 任何其它图片来源，此时继续丢弃横版封面等于永远显示占位图；这种场景下横版
 * 也远好过没有图（#kg218897：kungal 侧只有 460×215 与 560×420 两张横版）。
 */
export function shouldUseKungalCover(
  cover: CoverDimensions | null | undefined,
  hasExistingImage: boolean,
): boolean {
  if (hasUsablePortraitCover(cover)) return true
  return !hasExistingImage && hasUsableCover(cover)
}

/**
 * Replace the VNDB image host in a stored `url` with the configured base URL.
 * Handles both the legacy `t.vndb.org` host and the default mirror host.
 * Safe to call on null/undefined — returns null.
 */
export function transformStoredUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null
  return url
    .replace(VNDB_LEGACY_HOST, baseUrl)
    .replace(VNDB_IMAGE_HOST, baseUrl)
}
