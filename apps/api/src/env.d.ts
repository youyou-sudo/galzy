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
    CLOUDREVE_EMAIL: string
    CLOUDREVE_HOST: string
    CLOUDREVE_PASSWORD: string
    CLOUDREVE_DOWNLOAD_HOST: string
    CLOUDREVE_UPLOAD_DIR?: string
    NODE_ENV: string
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
