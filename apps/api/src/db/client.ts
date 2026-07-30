import { SQL } from 'bun'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import * as schema from './schema'

const poolMax = Number(process.env.POSTGRES_POOL_MAX ?? 10)
const poolIdleTimeout = Number(process.env.POSTGRES_POOL_IDLETIMEOUT ?? 300)

const client = new SQL({
  url: process.env.DATABASE_URL!,
  max: poolMax,
  idleTimeout: poolIdleTimeout,
})

export const db = drizzle({ client, schema })

// Set per-session timeout to prevent runaway queries from holding connections.
// Also set at database level via migration 0010 for all connections.
await db.execute(sql.raw(`SET statement_timeout = '30s'`))

export { sql }
