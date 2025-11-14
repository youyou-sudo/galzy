import { Elysia } from 'elysia'
import { Umami } from './service'
import { UmamiModel } from './model'

export const umami = new Elysia({ prefix: '/umami' })
  .get('/remfTag', async () => {
    return await Umami.remfTagGet()
  })
  .get('/remfGame', async () => {
    return await Umami.remfGameGet()
  })
  .get('/gameDloadNuber', async ({ query: { vid } }) => {
    return await Umami.gameDloadNuber({ vid })
  }, {
    query: UmamiModel.gameDloadNuber
  })
