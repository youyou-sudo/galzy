import { ViewsModel } from '@api/modules/views/model'
import { ViewsService } from '@api/modules/views/service'
import { Elysia } from 'elysia'

export const views = new Elysia({ prefix: '/views' })
  .post(
    '/game',
    async ({ body }) => {
      await ViewsService.recordGameView(body)
    },
    {
      body: ViewsModel.RecordGameView,
    },
  )
  .post(
    '/tag',
    async ({ body }) => {
      await ViewsService.recordTagView(body)
    },
    {
      body: ViewsModel.RecordTagView,
    },
  )
  .get('/hot/game', async () => {
    return await ViewsService.getHotGames()
  })
  .get('/hot/tag', async () => {
    return await ViewsService.getHotTags()
  })
