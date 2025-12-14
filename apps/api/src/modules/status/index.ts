import { Elysia } from 'elysia'
import { deployStatus } from './service'

export const status = new Elysia({ prefix: '/status' }).get('/', async () => {
  return {
    status: deployStatus,
  }
})
