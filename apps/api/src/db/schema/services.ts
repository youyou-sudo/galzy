import { pgTable, text, varchar, boolean, integer, timestamp, serial, bigint, jsonb, real } from 'drizzle-orm/pg-core'

// galrc_cloudflare
export const cloudflare = pgTable('galrc_cloudflare', {
  id: serial('id').primaryKey(),
  aEmail: text('a_email').notNull(),
  aKey: text('a_key').notNull(),
  accountId: text('account_id').notNull(),
  wokerName: varchar('woker_name', { length: 255 }).notNull(),
  urlEndpoint: text('url_endpoint'),
  state: boolean('state').notNull().default(true),
  enable: boolean('enable').notNull().default(false),
  duration: real('duration').notNull().default(0),
  errors: bigint('errors', { mode: 'number' }).notNull().default(0),
  requests: bigint('requests', { mode: 'number' }).notNull().default(0),
  responseBodySize: bigint('responseBodySize', { mode: 'number' }).notNull().default(0),
  subrequests: bigint('subrequests', { mode: 'number' }).notNull().default(0),
  updateTime: timestamp('updateTime'),
})

// galrc_siteConfig
export const siteConfig = pgTable('galrc_siteConfig', {
  key: varchar('key', { length: 255 }).primaryKey(),
  config: jsonb('config'),
})

// galrc_gameDownloadStats
export const gameDownloadStats = pgTable('galrc_gameDownloadStats', {
  id: serial('id').notNull().primaryKey(),
  gameId: varchar('game_id', { length: 255 }).notNull(),
  filePath: text('file_path').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// galrc_collections
export const collections = pgTable('galrc_collections', {
  id: serial('id').notNull().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  alias: varchar('alias', { length: 255 }).notNull(),
  description: text('description'),
})

// galrc_collectionsItems
export const collectionsItems = pgTable('galrc_collectionsItems', {
  id: serial('id').notNull().primaryKey(),
  collectionId: bigint('collection_id', { mode: 'number' }).notNull(),
  gameId: varchar('game_id', { length: 255 }).notNull(),
})
