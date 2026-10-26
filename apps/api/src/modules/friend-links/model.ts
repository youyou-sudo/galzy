import { t } from 'elysia'

export namespace FriendLinkModel {
  export const Params = t.Object({
    id: t.String(),
  })

  export const Create = t.Object({
    title: t.String({ minLength: 1 }),
    avatar: t.Optional(t.String()),
    href: t.String({ minLength: 1 }),
    description: t.Optional(t.String()),
    sortOrder: t.Optional(t.Number()),
  })

  export const Update = t.Object({
    title: t.Optional(t.String({ minLength: 1 })),
    avatar: t.Optional(t.String()),
    href: t.Optional(t.String({ minLength: 1 })),
    description: t.Optional(t.String()),
    sortOrder: t.Optional(t.Number()),
  })

  // 拖动排序：数组下标即新的 sortOrder
  export const Reorder = t.Object({
    ids: t.Array(t.Number()),
  })

  export type params = typeof Params.static
  export type create = typeof Create.static
  export type update = typeof Update.static
  export type reorder = typeof Reorder.static
}
