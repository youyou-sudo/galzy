import { t } from 'elysia'

export namespace TopicModel {
  export const List = t.Object({
    page: t.Optional(t.Number({ default: 1, minimum: 1 })),
    limit: t.Optional(t.Number({ default: 20, minimum: 1, maximum: 100 })),
    status: t.Optional(t.String({ minLength: 1 })),
    userId: t.Optional(t.String()),
  })

  export const Create = t.Object({
    title: t.String({ minLength: 1 }),
    content: t.String({ minLength: 1 }),
  })

  export const Update = t.Object({
    title: t.Optional(t.String({ minLength: 1 })),
    content: t.Optional(t.String({ minLength: 1 })),
    status: t.Optional(t.String({ minLength: 1 })),
  })

  export const Params = t.Object({
    id: t.String(),
  })

  export const LikeToggle = t.Object({})

  export const LikeStatus = t.Object({
    userId: t.Optional(t.String()),
  })

  export type list = typeof List.static
  export type create = typeof Create.static
  export type update = typeof Update.static
  export type params = typeof Params.static
  export type likeToggle = typeof LikeToggle.static
  export type likeStatus = typeof LikeStatus.static
}
