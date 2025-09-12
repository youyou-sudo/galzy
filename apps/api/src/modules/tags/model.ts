import { t } from 'elysia'

export namespace TagsModel {
  export const gameTags = t.Object({
    id: t.String({ minLength: 1 }),
  })
  export const tagId = t.Object({
    tagId: t.String({ minLength: 1 }),
  })
  export const tagGames = t.Object({
    tagId: t.String({ minLength: 1 }),
    pageSize: t.Number({ minimum: 1, default: 10 }),
    pageIndex: t.Number({ minimum: 0, default: 0 }),
  })
  export const tagAll = t.Object({
    pageSize: t.Number({ minLength: 1, default: 10 }),
    pageIndex: t.Number({ minimum: 0, default: 0 }),
    keyword: t.Union([t.String(), t.Undefined()]),
    id: t.Union([t.String(), t.Undefined()]),
  })
  export const tagEdit = t.Object({
    id: t.String({ minLength: 1 }),
    zh_name: t.String({ minLength: 1 }),
    exhibition: t.Boolean(),
    zh_alias: t.String(),
    zh_description: t.String(),
  })
  export const tagFileAdd = t.Object({
    file: t.File(),
  })
  export type gameTags = typeof gameTags.static
  export type tagId = typeof tagId.static
  export type tagGames = typeof tagGames.static
  export type tagAll = typeof tagAll.static
  export type tagEdit = typeof tagEdit.static
  export type tagFileAdd = typeof tagFileAdd.static
}
