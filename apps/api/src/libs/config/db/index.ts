import type { BunPostgresDialectConfig } from 'kysely-bun-sql'

export const dbConfig: BunPostgresDialectConfig = {
  // Provide a URL OR an existing SQL client
  url: process.env.DATABASE_URL,
  // client?: new SQL(urlOrOpts)

  // Called once per reserved connection
  onCreateConnection: async (conn) => {
    // e.g. set app_name, or run per-connection SETs
    await conn.executeQuery({ sql: 'select 1', parameters: [] } as any)
  },

  // Optional: tune Bun SQL client when we create it for you
  clientOptions: {
    max: Number(process.env.POSTGRES_POOL_MAX),
    idleTimeout: 30,
    maxLifetime: 0,
    connectionTimeout: 10,
    prepare: true,
    bigint: false,
    // tls: true | { ...advanced }
  },

  // Optional: close timeout when shutting down the pool
  closeOptions: { timeout: 5 },
}

export const vndbDbConfig: BunPostgresDialectConfig = {
  // Provide a URL OR an existing SQL client
  url: process.env.DEVVNDB_DATABASE_URL || process.env.VNDB_DATABASE_URL,
  // client?: new SQL(urlOrOpts)

  // Called once per reserved connection
  onCreateConnection: async (conn) => {
    // e.g. set app_name, or run per-connection SETs
    await conn.executeQuery({ sql: 'select 1', parameters: [] } as any)
  },

  // Optional: tune Bun SQL client when we create it for you
  clientOptions: {
    max: Number(process.env.POSTGRES_POOL_MAX),
    idleTimeout: 30,
    maxLifetime: 0,
    connectionTimeout: 10,
    prepare: true,
    bigint: false,
    // tls: true | { ...advanced }
  },

  // Optional: close timeout when shutting down the pool
  closeOptions: { timeout: 5 },
}
