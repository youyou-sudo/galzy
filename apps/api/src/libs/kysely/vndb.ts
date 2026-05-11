import { vndbDbConfig } from '@api/libs/config'
import { Kysely } from 'kysely'
import { BunPostgresDialect } from 'kysely-bun-sql'

const dialect = new BunPostgresDialect(vndbDbConfig)

export const vndbDb = new Kysely({
  dialect,
})
