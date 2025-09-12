import { Elysia } from 'elysia'
import { Umami } from './service'

export const umami = new Elysia({ prefix: '/umami' })
  .get('/remfTag', async () => {
    return await Umami.remfTagGet()
  })
  .get('/remfGame', async () => {
    return await Umami.remfGameGet()
  })
