export const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.POSTGRES_POOL_MAX),
}

export const vndbDbConfig = {
  connectionString: process.env.DEVVNDB_DATABASE_URL || process.env.VNDB_DATABASE_URL,
  max: Number(process.env.POSTGRES_POOL_MAX),
}
