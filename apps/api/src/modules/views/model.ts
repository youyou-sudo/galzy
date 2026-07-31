import { t } from 'elysia'

export namespace ViewsModel {
  export const RecordGameView = t.Object({
    gameId: t.String({ minLength: 1 }),
  })
  export type recordGameView = typeof RecordGameView.static

  export const RecordTagView = t.Object({
    tagId: t.String({ minLength: 1 }),
  })
  export type recordTagView = typeof RecordTagView.static

  export type GameRankingItem = {
    id: string
    title: string | null
    total: number
    imageId: string | null
    imageWidth: number | null
    imageHeight: number | null
    imageUrl: string | null
    cSexualAvg: number | null
  }
  export type TagRankingItem = {
    tag: string
    title: string | null
    total: number
  }
}
