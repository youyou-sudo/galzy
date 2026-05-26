import { UmamiModel } from '@api/modules/umami/model'
import { Umami } from '@api/modules/umami/service'
import { Elysia } from 'elysia'

export const umami = new Elysia({ prefix: '/umami' })
  .get('/remfTag', async () => {
    return await Umami.remfTagGet()
  })
  .get('/remfGame', async () => {
    return await Umami.remfGameGet()
  })
  .get(
    '/gameDloadNuber',
    async ({ query: { vid } }) => {
      return await Umami.gameDloadNuber({ vid })
    },
    {
      query: UmamiModel.gameDloadNuber,
    },
  )
