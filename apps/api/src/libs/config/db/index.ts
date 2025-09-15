export const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.POSTGRES_POOL_MAX),
}

export const vndbDbConfig = {
  connectionString: process.env.VNDB_DATABASE_URL,
  max: Number(process.env.POSTGRES_POOL_MAX),
}
