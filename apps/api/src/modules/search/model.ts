import { t } from 'elysia'
import type { Tags } from '../tags/service'

export namespace SearchModel {
  export const search = t.Object({
    q: t.String(),
    limit: t.Number({ minimum: 1 }),
  })
  export const meilisearchEmbeddersUpdate = t.Object({
    url: t.String(),
    embeddingApiKey: t.String(),
    model: t.String(),
    documentTemplateMaxBytes: t.Number(),
    documentTemplate: t.String()
  })
  export const meilisearcSearchableAttributeshUpdate = t.Object({
    fields: t.Array(t.String()),
  })
  export type tagAllReturn = Awaited<ReturnType<typeof Tags.tagAllGet>>
  export type search = typeof search.static
  export type meilisearchEmbeddersUpdate = typeof meilisearchEmbeddersUpdate.static
  export type meilisearcSearchableAttributeshUpdate = typeof meilisearcSearchableAttributeshUpdate.static
}
