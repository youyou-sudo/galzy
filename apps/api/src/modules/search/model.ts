import { t } from 'elysia'
import type { Tags } from '../tags/service'

export namespace SearchModel {
  export const search = t.Object({
    q: t.Optional(t.String()),
    limit: t.Optional(t.Number({ minimum: 1 })),
    startDate: t.Optional(t.String()),
    endDate: t.Optional(t.String()),
  })

  // Unified game search params — full-text + sort + filter + facets
  export const gameSearch = t.Object({
    q: t.Optional(t.String({ default: '' })),
    page: t.Optional(t.Number({ minimum: 1, default: 1 })),
    hitsPerPage: t.Optional(
      t.Number({ minimum: 1, maximum: 100, default: 24 }),
    ),
    sortBy: t.Optional(
      t.Union([
        t.Literal('released_first'),
        t.Literal('rating'),
        t.Literal('votecount'),
        t.Literal('dl_count'),
        t.Literal('vw_count'),
        t.Literal('id'),
      ]),
    ),
    order: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')])),
    olang: t.Optional(t.String()),
    tags: t.Optional(t.Union([t.String(), t.Array(t.String())])),
    startDate: t.Optional(t.String()),
    endDate: t.Optional(t.String()),
    // false → 过滤掉 R18（images.c_sexual_avg >= 1）游戏；缺省/true → 不过滤
    r18: t.Optional(t.Boolean()),
  })

  export const meilisearchEmbeddersUpdate = t.Object({
    url: t.String(),
    embeddingApiKey: t.String(),
    model: t.String(),
    documentTemplateMaxBytes: t.Number(),
    documentTemplate: t.String(),
  })
  export const meilisearchSearchableAttributesUpdate = t.Object({
    fields: t.Array(t.String()),
    indexName: t.Optional(t.String()),
  })
  export type tagAllReturn = Awaited<ReturnType<typeof Tags.tagAllGet>>
  export const tagSearch = t.Object({
    q: t.Optional(t.String()),
    limit: t.Optional(t.Number({ minimum: 1, default: 50 })),
  })
  export type tagSearch = typeof tagSearch.static
  export const producerSearch = t.Object({
    q: t.Optional(t.String()),
    page: t.Optional(t.Number({ minimum: 1, default: 1 })),
    hitsPerPage: t.Optional(
      t.Number({ minimum: 1, maximum: 100, default: 24 }),
    ),
  })
  export type producerSearch = typeof producerSearch.static
  export type search = typeof search.static
  export type gameSearch = typeof gameSearch.static
  export type meilisearchEmbeddersUpdate =
    typeof meilisearchEmbeddersUpdate.static
  export type meilisearchSearchableAttributesUpdate =
    typeof meilisearchSearchableAttributesUpdate.static
}
