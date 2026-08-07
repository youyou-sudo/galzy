import { betterAuth } from '@api/modules/auth'
import { Elysia } from 'elysia'
import { StrategyModel } from './model'
import { Strategy } from './service'

export const strategy = new Elysia({ prefix: '/strategy' })
  .use(betterAuth)
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
      isAdmin: true,
      body: StrategyModel.strategyListUpdate,
    },
  )
  .post(
    '/strategylistcreate',
    async ({ body: { id, data }, user }) => {
      return await Strategy.strategyCreate({
        id,
        data,
        userid: user.id,
        isAdmin: user.role === 'admin',
      })
    },
    {
      auth: true,
      body: StrategyModel.strategyListCreate,
    },
  )
  .post(
    '/strategylistdelete',
    async ({ body: { strategyId, gameId } }) => {
      return await Strategy.strategyDelete({ strategyId, gameId })
    },
    {
      isAdmin: true,
      body: StrategyModel.strategy,
    },
  )
  .get(
    '/admin/articles',
    async ({ query }) => {
      return await Strategy.adminListAll(query)
    },
    {
      isAdmin: true,
      query: StrategyModel.adminArticleListQuery,
    },
  )
  .post(
    '/admin/articles/status',
    async ({ body: { id, status } }) => {
      return await Strategy.adminChangeStatus({ id, status })
    },
    {
      isAdmin: true,
      body: StrategyModel.adminArticleStatus,
    },
  )
