import { db, sql } from '@api/db/client'
import { deployStatus } from '@api/modules/status/service'
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

  // 启动阶段 DB 连接/迁移失败（deployStatus = 'error'）时返回 503，
  // 让编排层（Docker/k8s 重启策略）拉起新进程重试，而不是带病长跑。
  if (deployStatus === 'error') {
    return Response.json(
      { ok: false, db: dbOk, redis: redisOk },
      { status: 503 },
    )
  }

  return Response.json({ ok: true, db: dbOk, redis: redisOk })
})
