import { Elysia } from 'elysia'

export const health = new Elysia({ prefix: '/health' }).get('/', () =>
  Response.json({ ok: true }),
)
