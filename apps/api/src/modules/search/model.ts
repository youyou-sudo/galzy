import { t } from 'elysia'
import type { Tags } from '../tags/service'

export namespace SearchModel {
  export const search = t.Object({
    q: t.Optional(t.String()),
    limit: t.Optional(t.Number({ minimum: 1 })),
    startDate: t.Optional(t.String()),
    endDate: t.Optional(t.String()),
  })
  export const meilisearchEmbeddersUpdate = t.Object({
    url: t.String(),
    embeddingApiKey: t.String(),
    model: t.String(),
    documentTemplateMaxBytes: t.Number(),
    documentTemplate: t.String(),
  })
  export const meilisearcSearchableAttributeshUpdate = t.Object({
    fields: t.Array(t.String()),
  })
  export const taskQuery = t.Object({
    uid: t.Number(),
  })
  export type tagAllReturn = Awaited<ReturnType<typeof Tags.tagAllGet>>
  export type search = typeof search.static
  export type meilisearchEmbeddersUpdate =
    typeof meilisearchEmbeddersUpdate.static
  export type meilisearcSearchableAttributeshUpdate =
    typeof meilisearcSearchableAttributeshUpdate.static
  export type taskQuery = typeof taskQuery.static
}
