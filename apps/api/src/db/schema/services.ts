import { pgTable, text, varchar, boolean, integer, timestamp, serial, bigint, jsonb, real, index } from 'drizzle-orm/pg-core'

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
}, (table) => ({
  stateIdx: index('idx_galrc_cloudflare_state').on(table.state),
  enableIdx: index('idx_galrc_cloudflare_enable').on(table.enable),
}))

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
}, (table) => ({
  gameIdIdx: index('idx_galrc_game_download_stats_game_id').on(table.gameId),
  createdAtIdx: index('idx_galrc_game_download_stats_created_at').on(table.createdAt),
}))

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
}, (table) => ({
  collectionIdIdx: index('idx_galrc_collections_items_collection_id').on(table.collectionId),
  gameIdIdx: index('idx_galrc_collections_items_game_id').on(table.gameId),
}))
