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
  export type strategy = typeof strategy.static
  export type gameStrategys = typeof gameStrategys.static
  export type strategyListUpdate = typeof strategyListUpdate.static
}
