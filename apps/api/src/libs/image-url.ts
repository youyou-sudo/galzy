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

/** Only use a source cover when it has safe, portrait dimensions. */
export function hasUsablePortraitCover(
  cover: CoverDimensions | null | undefined,
): boolean {
  return (
    typeof cover?.url === 'string' &&
    cover.url.length > 0 &&
    typeof cover.width === 'number' &&
    Number.isFinite(cover.width) &&
    cover.width > 0 &&
    typeof cover.height === 'number' &&
    Number.isFinite(cover.height) &&
    cover.height > 0 &&
    cover.height >= cover.width
  )
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
