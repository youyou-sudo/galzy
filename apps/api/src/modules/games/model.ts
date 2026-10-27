import { t } from 'elysia'

export namespace GameModel {
  export const gameList = t.Object({
    pageSize: t.Number({ minimum: 1 }),
    pageIndex: t.Number({ minimum: 0 }),
    sortBy: t.Optional(
      t.UnionEnum(['id', 'released', 'downloads', 'views'], {
        default: 'id',
      }),
    ),
    order: t.Optional(t.UnionEnum(['asc', 'desc'], { default: 'desc' })),
  })
  export const infoId = t.Object({
    id: t.String({ minLength: 1 }),
  })
  export const gameTimeNumberGet = t.Object({
    id: t.String({ minLength: 1 }),
    time: t.Optional(t.String()),
  })
  export const openListFiles = t.Object({
    id: t.String({ minLength: 1 }),
  })
  /**
   * 管理员刷新文件列表：清掉该作品在 Redis 里的 OpenListFiles 缓存并重新构建。
   * 与 openListFiles 同一个 id 语义（/kgX 与 /vNNN 都接受）。
   */
  export const openListFilesRefresh = t.Object({
    id: t.String({ minLength: 1 }),
  })
  export const dataFiltering = t.Object({
    vid: t.Optional(t.Union([t.Number(), t.Null()])),
    otherId: t.Optional(t.Union([t.Number(), t.Null()])),
    query: t.Any(),
    limit: t.Number({ minimum: 1 }),
    page: t.Number({ minimum: 1 }),
  })
  export const vidassociationUpdate = t.Object({
    id: t.Union([t.Number(), t.Null(), t.Undefined()]),
    data: t.Any(),
  })
  export const QuickSearch = t.Object({
    q: t.String({ minLength: 1 }),
    limit: t.Optional(t.Number({ default: 20, minimum: 1, maximum: 50 })),
  })
  export type TreeNode = {
    id: string
    name: string
    type: 'folder' | 'file'
    size?: string
    format?: string
    volumes?: boolean
    children?: TreeNode[]
    sign?: string
    redame?: string
  }
  export type OpenListFiles = typeof openListFiles.static
  export type openListFilesRefresh = typeof openListFilesRefresh.static
  export type infoId = typeof infoId.static
  export type gameList = typeof gameList.static
  export type dataFiltering = typeof dataFiltering.static
  export type vidassociationUpdate = typeof vidassociationUpdate.static
  export type gameTimeNumberGet = typeof gameTimeNumberGet.static
}
