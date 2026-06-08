import { t } from 'elysia'

export namespace CommentModel {
  export const List = t.Object({
    targetType: t.Optional(t.String()),
    targetId: t.Optional(t.String()),
    page: t.Optional(t.Number({ default: 1 })),
    limit: t.Optional(t.Number({ default: 20 })),
    type: t.Optional(t.String()),
    status: t.Optional(t.String()),
  })

  export const Create = t.Object({
    targetType: t.String(),
    targetId: t.String(),
    content: t.String({ minLength: 1 }),
    type: t.Optional(t.String()),
    parentId: t.Optional(t.Nullable(t.String())),
    replyToUserId: t.Optional(t.Nullable(t.String())),
  })

  export const Update = t.Object({
    content: t.String({ minLength: 1 }),
  })

  export const ChangeStatus = t.Object({
    status: t.String(),
  })

  export const Params = t.Object({
    id: t.String(),
  })

  export type list = typeof List.static
  export type create = typeof Create.static
  export type update = typeof Update.static
  export type changeStatus = typeof ChangeStatus.static
  export type params = typeof Params.static
}
