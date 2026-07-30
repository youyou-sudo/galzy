/**
 * Cloudflare Cache Purge — ISR page cache invalidation
 *
 * Uses Cloudflare Cache API to purge cached HTML pages by URL, Cache-Tag,
 * or prefix. Called from API service modules when data changes.
 *
 * Requires env vars:
 *   CLOUDFLARE_ZONE_ID   — Zone ID from Cloudflare dashboard
 *   CLOUDFLARE_API_TOKEN — API token with "Cache Purge" permission
 */

const CF_API = 'https://api.cloudflare.com/client/v4'

async function cfPurge(
  path: string,
  body: Record<string, unknown>,
): Promise<void> {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID
  const token = process.env.CLOUDFLARE_API_TOKEN

  if (!zoneId || !token) {
    console.warn(
      '[cloudflare-cache] CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN not set, skipping purge',
    )
    return
  }

  try {
    const res = await fetch(`${CF_API}/zones/${zoneId}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      console.error(
        `[cloudflare-cache] purge failed (${res.status}):`,
        await res.text().catch(() => '<unreadable>'),
      )
      return
    }

    const data = await res.json()
    if (!data.success) {
      console.error(
        '[cloudflare-cache] purge API error:',
        JSON.stringify(data.errors ?? data),
      )
    }
  } catch (err) {
    console.error('[cloudflare-cache] purge request failed:', err)
  }
}

// ── Base purge operations ──

/** Purge by exact URLs (up to 30 per call) */
export async function purgeByUrls(urls: string[]): Promise<void> {
  if (urls.length === 0) return
  await cfPurge('purge_cache', { files: urls })
}

/** Purge by Cache-Tag (up to 30 per call) — preferred method */
export async function purgeByTags(tags: string[]): Promise<void> {
  if (tags.length === 0) return
  await cfPurge('purge_cache', { tags })
}

/** Purge by URL prefix, e.g. "/games/" clears /games, /games/123, etc. */
export async function purgeByPrefixes(prefixes: string[]): Promise<void> {
  if (prefixes.length === 0) return
  await cfPurge('purge_cache', { prefixes })
}

/** Purge everything — use with caution */
export async function purgeEverything(): Promise<void> {
  await cfPurge('purge_cache', { purge_everything: true })
}

// ── Domain-specific helpers ──

/** Game data changed: clear the game detail page, homepage, and game list */
export async function purgeGamePages(gameId: string): Promise<void> {
  await purgeByTags([`game-${gameId}`, 'page-home', 'page-games'])
}

/** Collection changed: clear the collection page, homepage, and collection list */
export async function purgeCollectionPages(
  collectionId: string,
): Promise<void> {
  await purgeByTags([
    `collection-${collectionId}`,
    'page-home',
    'page-collections',
  ])
}

/** Tag translation changed: clear the tag page and tag list */
export async function purgeTagPages(tagId: string): Promise<void> {
  await purgeByTags([`tag-${tagId}`, 'page-tags'])
}

/** Producer changed */
export async function purgeProducerPages(producerId: string): Promise<void> {
  await purgeByTags([`producer-${producerId}`, 'page-producers'])
}

/** Homepage rankings updated (cron) */
export async function purgeHomePage(): Promise<void> {
  await purgeByTags(['page-home'])
}

/** VNDB sync completed — broad invalidation */
export async function purgeAfterSync(): Promise<void> {
  await purgeByTags([
    'page-home',
    'page-games',
    'page-tags',
    'page-collections',
    'page-producers',
  ])
}
