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

  /**
   * 论坛帖子阅读数：targetId 是自增整数（URL 里可能带前导零），
   * service 层统一折算成 String(Number(topicId)) 再入库。
   */
  export const RecordTopicView = t.Object({
    topicId: t.String({ minLength: 1 }),
  })
  export type recordTopicView = typeof RecordTopicView.static

  export const HotGame = t.Object({
    r18: t.Optional(t.Boolean()),
  })
  export type hotGame = typeof HotGame.static

  export type GameRankingItem = {
    id: string
    title: string | null
    total: number
    imageId: string | null
    imageWidth: number | null
    imageHeight: number | null
    imageThumbhash: string | null
    imageUrl: string | null
    cSexualAvg: number | null
  }
  export type TagRankingItem = {
    tag: string
    title: string | null
    total: number
  }
}
