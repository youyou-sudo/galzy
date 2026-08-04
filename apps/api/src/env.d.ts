declare module 'bun' {
  interface Env {
    DATABASE_URL: string
    DISCORD_CLIENT_ID: string
    DISCORD_CLIENT_SECRET: string
    EMAIL_KEY: string
    GITHUB_CLIENT_ID: string
    GITHUB_CLIENT_SECRET: string
    KUNGAL_CLIENT_ID: string
    KUNGAL_CLIENT_SECRET: string
    LINUXDO_CLIENT_ID: string
    LINUXDO_CLIENT_SECRET: string
    MEILISEARCH_HOST: string
    MEILISEARCH_INDEXNAME: string
    MEILISEARCH_MASTER: string
    MEILISEARCH_PRODUCER_INDEXNAME: string
    MEILISEARCH_TAG_INDEXNAME: string
    NODE_ENV: string
    OPENLIST_API_KEY: string
    OPENLIST_HOST: string
    S3_ACCESS_KEY_ID: string
    S3_BUCKET: string
    S3_ENDPOINT: string
    S3_IMAGEURL: string
    S3_REGION: string
    S3_SECRET_ACCESS_KEY: string
    TWITTER_CLIENT_ID: string
    TWITTER_CLIENT_SECRET: string
    VNDB_API_TOKEN: string
    WEB_HOST: string
  }
}
