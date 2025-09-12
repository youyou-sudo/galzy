import { t } from 'elysia'

export namespace GameModel {
  export const gameList = t.Object({
    pageSize: t.Number({ minimum: 1 }),
    pageIndex: t.Number({ minimum: 0 }),
  })
  export const infoId = t.Object({
    id: t.String({ minLength: 1 }),
  })
  export const openListFiles = t.Object({
    id: t.String({ minLength: 1 }),
  })
  export const dataFiltering = t.Object({
    vid: t.Union([t.Number(), t.Null(), t.Undefined()]),
    otherId: t.Union([t.Number(), t.Null(), t.Undefined()]),
    query: t.Any(),
    limit: t.Number({ minimum: 1 }),
    page: t.Number({ minimum: 1 }),
  })
  export const vidassociationUpdate = t.Object({
    id: t.Union([t.Number(), t.Null(), t.Undefined()]),
    data: t.Any(),
  })
  export type TreeNode = {
    id: string
    name: string
    type: 'folder' | 'file'
    size?: string
    format?: string
    children?: TreeNode[]
    sign?: string
    redame?: string

  }
  export type OpenListFiles = typeof openListFiles.static
  export type infoId = typeof infoId.static
  export type gameList = typeof gameList.static
  export type dataFiltering = typeof dataFiltering.static
  export type vidassociationUpdate = typeof vidassociationUpdate.static
}
