import { t } from 'elysia'

export namespace StrategyModel {
  export const strategy = t.Object({
    strategyId: t.Number({ minimum: 0 }),
    gameId: t.Optional(t.String({ minLength: 1 })),
  })
  export const gameStrategys = t.Object({
    gameId: t.String({ minLength: 1 }),
  })
  export const strategyListUpdate = t.Object({
    id: t.String({ minLength: 1 }),
    data: t.Any(),
  })
  export const strategyListCreate = t.Object({
    id: t.String({ minLength: 1 }),
    data: t.Any(),
  })
  export const adminArticleListQuery = t.Object({
    page: t.Optional(t.Number({ minimum: 1 })),
    limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
    status: t.Optional(t.String({ minLength: 1 })),
    type: t.Optional(t.String({ minLength: 1 })),
    search: t.Optional(t.String({ minLength: 1 })),
  })
  export const adminArticleStatus = t.Object({
    id: t.Number({ minimum: 1 }),
    status: t.String({ minLength: 1 }),
  })
  export type strategy = typeof strategy.static
  export type gameStrategys = typeof gameStrategys.static
  export type strategyListUpdate = typeof strategyListUpdate.static
  export type strategyListCreate = typeof strategyListCreate.static
  export type adminArticleListQuery = typeof adminArticleListQuery.static
  export type adminArticleStatus = typeof adminArticleStatus.static
}
