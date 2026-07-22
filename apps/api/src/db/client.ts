import { SQL } from 'bun'
import { drizzle } from 'drizzle-orm/bun-sql'

const client = new SQL(process.env.DATABASE_URL!)
export const db = drizzle({ client })
export { sql } from 'drizzle-orm'
