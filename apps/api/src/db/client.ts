import { SQL } from 'bun'
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

export { sql } from 'drizzle-orm'
