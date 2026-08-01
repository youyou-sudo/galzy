import { SQL } from 'bun'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import * as schema from './schema'

const poolMax = Number(process.env.POSTGRES_POOL_MAX ?? 10)

const client = new SQL({
  url: process.env.DATABASE_URL!,
  max: poolMax,
  // 禁用连接空闲回收（0 = 不注册空闲定时器）：bun:sql 会把空闲超时的连接标记为
  // failed，但并发查询仍可能被派发到这些连接上，报 "Idle timeout reached after 5m"，
  // 导致长时间无流量后的首批请求 500。死连接会在下次使用时自动重建。
  // better-auth 也走此连接池（modules/auth/service.ts 的 drizzleAdapter）。
  idleTimeout: 0,
})

export const db = drizzle({ client, schema })

// Set per-session timeout to prevent runaway queries from holding connections.
// Also set at database level via migration 0010 for all connections.
await db.execute(sql.raw(`SET statement_timeout = '30s'`))

export { sql }
