import { Elysia } from 'elysia'
import { GameModel } from './model'
import { Game } from './service'

export const game = new Elysia({ prefix: '/games' })
  .get(
    '/',
    async ({ query: { id } }) => {
      return await Game.InfoGet({ id })
    },
    {
      query: GameModel.infoId,
    },
  )
  .get('/count', async () => {
    return await Game.Count()
  })
  .get(
    '/gamelist',
    async ({ query: { pageIndex, pageSize } }) => {
      return await Game.List({
        pageIndex,
        pageSize,
      })
    },
    { query: GameModel.gameList },
  )
  .get(
    '/search',
    async ({ query: { pageIndex, pageSize } }) => {
      return await Game.List({
        pageIndex: pageIndex,
        pageSize: pageSize,
      })
    },
    { query: GameModel.gameList },
  )
  .get(
    '/openlistfiles',
    async ({ query: { id } }) => {
      return await Game.OpenListFiles({ id })
    },
    {
      query: GameModel.openListFiles,
    },
  )
  .get('/datafilteringstats', async () => {
    return await Game.DataFilteringStats()
  })
  .get(
    '/datafiltering',
    async ({ query: { vid, otherId, query, limit, page } }) => {
      return await Game.DataFiltering({
        vid,
        otherId,
        query,
        limit,
        page,
      })
    },
    {
      query: GameModel.dataFiltering,
    },
  )
  .get(
    '/vidassociation',
    async ({ query: { id } }) => {
      const data = await Game.VidassociationGet({
        id,
      })
      return data
    },
    {
      query: GameModel.infoId,
    },
  )
  .post(
    '/vidassociationupdate',
    async ({ body: { id, data } }) => {
      return await Game.vidassociationUpdate({
        id,
        data,
      })
    },
    {
      body: GameModel.vidassociationUpdate,
    },
  )
  .post('/vidassociationCreate', async () => {
    return await Game.vidassociationCreate()
  })
