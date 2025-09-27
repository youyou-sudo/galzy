import { Elysia } from 'elysia'
import { StrategyModel } from './model'
import { Strategy } from './service'

export const strategy = new Elysia({ prefix: '/strategy' })
  .get(
    '/gamestrategys',
    async ({ query: { gameId } }) => {
      return await Strategy.gameStrategys({ gameId })
    },
    {
      query: StrategyModel.gameStrategys,
    },
  )
  .get(
    '/strategy',
    async ({ query: { strategyId } }) => {
      return await Strategy.strategy({ strategyId })
    },
    {
      query: StrategyModel.strategy,
    },
  )
  .post(
    '/strategylistupdate',
    async ({ body: { id, data } }) => {
      return await Strategy.strategyUpdate({ id, data })
    },
    {
      body: StrategyModel.strategyListUpdate,
    },
  )
  .post(
    '/strategylistcreate',
    async ({ body: { id, data } }) => {
      return await Strategy.strategyCreate({ id, data })
    },
    {
      body: StrategyModel.strategyListUpdate,
    },
  )
  .post(
    '/strategylistdelete',
    async ({ body: { strategyId, gameId } }) => {
      return await Strategy.strategyDelete({ strategyId, gameId })
    },
    {
      body: StrategyModel.strategy,
    },
  )
