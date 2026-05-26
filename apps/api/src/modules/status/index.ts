import { deployStatus } from '@api/modules/status/service'
import { Elysia } from 'elysia'

export const status = new Elysia({ prefix: '/status' }).get('/', async () => {
  return {
    status: deployStatus,
  }
})
