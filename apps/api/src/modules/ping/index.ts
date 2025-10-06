import { Elysia } from 'elysia'

export const search = new Elysia({ prefix: '/ping' })
  .get(
    '/',
    async () => {
      return {
        status: 'ok',
      }
    }
  )
