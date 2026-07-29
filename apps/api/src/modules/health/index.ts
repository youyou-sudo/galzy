import { db, sql } from '@api/db/client'
import { redis } from 'bun'
import { Elysia } from 'elysia'

export const health = new Elysia({ prefix: '/health' }).get('/', async () => {
  let dbOk = false
  let redisOk = false

  try {
    await db.execute(sql`SELECT 1`)
    dbOk = true
  } catch {}

  try {
    redisOk = (await redis.ping()) === 'PONG'
  } catch {}

  return Response.json({ ok: true, db: dbOk, redis: redisOk })
})
