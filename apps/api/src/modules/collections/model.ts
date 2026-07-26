import { t } from 'elysia'

export namespace CollectionModel {
  export const List = t.Object({
    page: t.Optional(t.Number({ default: 1, minimum: 1 })),
    limit: t.Optional(t.Number({ default: 20, minimum: 1, maximum: 100 })),
    status: t.Optional(t.String()),
  })

  export const Params = t.Object({
    id: t.String(),
  })

  export const Create = t.Object({
    title: t.String({ minLength: 1 }),
    description: t.Optional(t.String()),
    type: t.Optional(t.String({ default: 'manual' })), // 'manual' | 'producer'
    producerIds: t.Optional(t.Array(t.String())),
    status: t.Optional(t.String({ default: 'published' })),
  })

  export const Update = t.Object({
    title: t.Optional(t.String({ minLength: 1 })),
    description: t.Optional(t.String()),
    type: t.Optional(t.String()), // 'manual' | 'producer'
    producerIds: t.Optional(t.Array(t.String())),
    status: t.Optional(t.String()),
    sortOrder: t.Optional(t.Number()),
  })

  export const UpdateEntries = t.Object({
    entries: t.Array(
      t.Object({
        vid: t.String(),
        sortOrder: t.Number(),
      }),
    ),
  })

  export type list = typeof List.static
  export type create = typeof Create.static
  export type update = typeof Update.static
  export type updateEntries = typeof UpdateEntries.static
}
