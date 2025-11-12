import { vndbDbConfig } from '@api/libs/config'
import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'

const dialect = new PostgresDialect({
  pool: new Pool(vndbDbConfig),
})

export const vndbDb = new Kysely({
  dialect,
})
