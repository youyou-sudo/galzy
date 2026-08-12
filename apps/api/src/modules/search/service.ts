import { buildCoverUrl, db, eventViews, MeiliClient } from '@api/libs'
import { delKv, getKv, setKv } from '@api/libs/redis'
import { status } from 'elysia'
import { t } from 'try'
import type { SearchModel } from './model'

export const Search = {
  async get({ q, limit, startDate, endDate }: SearchModel.search) {
    const safeQ = q?.replace(/[+\-*/=<>!&|%^$#@~?:;'",()[\]{}\\]/g, '').trim()
    const cacheKey = `galzy:search:${safeQ}:${limit}:${startDate ?? ''}:${endDate ?? ''}`
    const redisData = await getKv(cacheKey)

    if (redisData) {
      try {
        const parsed = JSON.parse(redisData)
        // Stale entries written before imageUrl existed must be rebuilt
        const hits = (parsed?.hits ?? []) as Array<Record<string, unknown>>
        const stale = hits.some((h) => {
          const img = h.images as Record<string, unknown> | null
          return !!img && !('imageUrl' in img)
        })
        if (!stale) return parsed as SearchReturn
        await delKv(cacheKey)
      } catch {
        await delKv(cacheKey)
      }
    }
    const filters: string[] = []

    if (startDate && endDate) {
      filters.push(
        `released_first >= ${startDate} AND released_first <= ${endDate}`,
      )
    }
    const [, error, [index, tagf]] = t(
      await Promise.all([
        MeiliClient.index(process.env.MEILISEARCH_INDEXNAME || '').search(
          safeQ,
          {
            limit: limit || 50,
            filter: filters.length ? filters.join(' AND ') : undefined,
          },
        ),
        MeiliClient.index(process.env.MEILISEARCH_TAG_INDEXNAME || '').search(
          safeQ,
          {
            limit: 1,
          },
        ),
      ]),
    )
    if (error) {
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    }
    const topTag = tagf.hits[0]

    // Record tag view for top matching tag (fire-and-forget)
    if (topTag && safeQ) {
      const tagId = (topTag as Record<string, unknown>).id as string | undefined
      if (tagId) {
        void db
          .insert(eventViews)
          .values({
            eventType: 'tag_view',
            targetId: tagId,
            createdAt: new Date(),
          })
          .catch(() => {})
      }
    }
    const data = {
      hits: index.hits,
      topTag: topTag
        ? (topTag as SearchModel.tagAllReturn['items'][0])
        : undefined,
    }
    // Backfill imageUrl for stale index docs (pre-reindex data lacks it)
    for (const hit of index.hits) {
      const img = (hit as Record<string, unknown>).images as Record<
        string,
        unknown
      > | null
      if (img?.id && !img.imageUrl) {
        img.imageUrl = buildCoverUrl(
          img.id as string,
          img.width as number,
          img.height as number,
        )
      }
    }
    void setKv(cacheKey, JSON.stringify(data), 60 * 60 * 1)
    type SearchReturn = typeof data
    return data
  },

  // Unified game search via Meilisearch — full-text + sort + filter + facets
  async searchGames(params: SearchModel.gameSearch) {
    const {
      q,
      page = 1,
      hitsPerPage = 24,
      sortBy,
      order,
      olang,
      tags,
      startDate,
      endDate,
      r18,
    } = params

    const safeQ =
      q?.replace(/[+\-*/=<>!&|%^$#@~?:;'",()[\]{}\\]/g, '').trim() ?? ''

    // Build filters
    const filters: string[] = []
    if (olang) filters.push(`olang = "${olang}"`)
    if (tags) {
      const tagArr = Array.isArray(tags) ? tags : [tags]
      const tagFilters = tagArr.map((t) => `tags = "${t}"`)
      if (tagFilters.length === 1) {
        filters.push(tagFilters[0])
      } else {
        filters.push(`(${tagFilters.join(' OR ')})`)
      }
    }
    if (startDate && endDate) {
      filters.push(
        `released_first >= "${startDate}" AND released_first <= "${endDate}"`,
      )
    }
    if (r18 === false) {
      // 健康模式：剔除 R18（c_sexual_avg >= 1）。NOT 形式对无封面文档（images=null）同样命中
      filters.push('NOT (images.c_sexual_avg >= 1)')
    }

    // Build sort
    const sort: string[] = []
    if (sortBy) {
      const dir = order === 'asc' ? 'asc' : 'desc'
      sort.push(`${sortBy}:${dir}`)
    }

    const index = MeiliClient.index(
      process.env.MEILISEARCH_INDEXNAME || 'galzy_games',
    )

    const result = await index.search(safeQ || '', {
      page,
      hitsPerPage,
      filter: filters.length ? filters.join(' AND ') : undefined,
      sort: sort.length ? sort : undefined,
      facets: ['olang', 'tags'],
    })

    // Record tag views from first search result (fire-and-forget)
    if (safeQ && result.hits.length > 0) {
      const firstHit = result.hits[0] as Record<string, unknown>
      const hitTags = firstHit.tags as string[] | undefined
      if (hitTags && hitTags.length > 0) {
        void db
          .insert(eventViews)
          .values(
            hitTags.map((tagId) => ({
              eventType: 'tag_view' as const,
              targetId: tagId,
              createdAt: new Date(),
            })),
          )
          .catch(() => {})
      }
    }

    // Backfill imageUrl for stale index docs (pre-reindex data lacks it)
    for (const hit of result.hits) {
      const img = (hit as Record<string, unknown>).images as Record<
        string,
        unknown
      > | null
      if (img?.id && !img.imageUrl) {
        img.imageUrl = buildCoverUrl(
          img.id as string,
          img.width as number,
          img.height as number,
        )
      }
    }

    return {
      hits: result.hits,
      totalHits: result.totalHits,
      totalPages: result.totalPages,
      page: result.page,
      hitsPerPage: result.hitsPerPage,
      facetDistribution: result.facetDistribution,
      processingTimeMs: result.processingTimeMs,
    }
  },
  async meilisearchEmbeddersUpdate({
    url,
    embeddingApiKey,
    model,
    documentTemplateMaxBytes,
    documentTemplate,
  }: SearchModel.meilisearchEmbeddersUpdate) {
    const indexdata = await MeiliClient.index(
      process.env.MEILISEARCH_INDEXNAME,
    ).updateEmbedders({
      body: {
        source: 'rest',
        url: url,
        headers: { Authorization: embeddingApiKey },
        request: { model: model, input: ['{{text}}', '{{..}}'] },
        documentTemplateMaxBytes: documentTemplateMaxBytes,
        response: {
          data: [
            {
              embedding: '{{embedding}}',
            },
            '{{..}}',
          ],
        },

        documentTemplate: documentTemplate,
      },
    })
    return indexdata
  },
  async meilisearchEmbeddersGet() {
    const indexdata = await MeiliClient.index(
      process.env.MEILISEARCH_INDEXNAME,
    ).getEmbedders()
    return indexdata
  },
  async meilisearchPropertylist(indexName?: string) {
    const name = indexName || process.env.MEILISEARCH_INDEXNAME
    const indexdata = await MeiliClient.index(name).getDocuments({ limit: 1 })
    if (indexdata.results && indexdata.results.length > 0) {
      return Object.keys(indexdata.results[0])
    }
    return []
  },
  async meilisearchSearchableAttributesGet(indexName?: string) {
    const name = indexName || process.env.MEILISEARCH_INDEXNAME
    const index = MeiliClient.index(name)

    const searchable = await index.getSearchableAttributes()

    if (
      Array.isArray(searchable) &&
      searchable.length === 1 &&
      searchable[0] === '*'
    ) {
      return await Search.meilisearchPropertylist(name)
    }
    return searchable
  },
  async meilisearchSearchableAttributesUpdate({
    fields,
    indexName,
  }: SearchModel.meilisearchSearchableAttributesUpdate) {
    try {
      const name = indexName || process.env.MEILISEARCH_INDEXNAME
      const index = MeiliClient.index(name)
      await index.updateSearchableAttributes(fields)
      return { code: 200 }
    } catch (error) {
      throw status(500, error)
    }
  },
  async searchTags({ q, limit }: SearchModel.tagSearch) {
    const safeQ =
      q?.replace(/[+\-*/=<>!&|%^$#@~?:;'",()[\]{}\\]/g, '').trim() || ''
    const result = await MeiliClient.index(
      process.env.MEILISEARCH_TAG_INDEXNAME || '',
    ).search(safeQ, {
      limit: limit || 50,
    })
    return {
      hits: result.hits,
      totalHits: result.estimatedTotalHits ?? 0,
    }
  },
  async searchProducers({
    q,
    page = 1,
    hitsPerPage = 24,
  }: SearchModel.producerSearch) {
    const safeQ =
      q?.replace(/[+\-*/=<>!&|%^$#@~?:;'",()[\]{}\\]/g, '').trim() || ''
    const result = await MeiliClient.index(
      process.env.MEILISEARCH_PRODUCER_INDEXNAME || 'galrc_Producer',
    ).search(safeQ, {
      page,
      hitsPerPage,
    })
    return {
      hits: result.hits,
      totalHits: result.totalHits ?? 0,
      totalPages: result.totalPages ?? 0,
      page: result.page ?? page,
      hitsPerPage: result.hitsPerPage ?? hitsPerPage,
    }
  },
  async getStats() {
    const indexdata = await MeiliClient.getStats()
    return indexdata
  },
}
