import { relations } from 'drizzle-orm'
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

// galrc_cloudflare
export const cloudflare = pgTable(
  'galrc_cloudflare',
  {
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
    responseBodySize: bigint('responseBodySize', { mode: 'number' })
      .notNull()
      .default(0),
    subrequests: bigint('subrequests', { mode: 'number' }).notNull().default(0),
    updateTime: timestamp('updateTime'),
  },
  (table) => ({
    stateIdx: index('idx_galrc_cloudflare_state').on(table.state),
    enableIdx: index('idx_galrc_cloudflare_enable').on(table.enable),
  }),
)

// galrc_siteConfig
export const siteConfig = pgTable('galrc_siteConfig', {
  key: varchar('key', { length: 255 }).primaryKey(),
  config: jsonb('config'),
})

// galrc_gameDownloadStats
export const gameDownloadStats = pgTable(
  'galrc_gameDownloadStats',
  {
    id: serial('id').notNull().primaryKey(),
    gameId: varchar('game_id', { length: 255 }).notNull(),
    filePath: text('file_path').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    gameIdIdx: index('idx_galrc_game_download_stats_game_id').on(table.gameId),
    createdAtIdx: index('idx_galrc_game_download_stats_created_at').on(
      table.createdAt,
    ),
  }),
)

// galrc_collections
export const collections = pgTable(
  'galrc_collections',
  {
    id: serial('id').notNull().primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    type: varchar('type', { length: 20 }).notNull().default('manual'), // 'manual' | 'producer'
    producerIds: jsonb('producer_ids'), // array of producer IDs, e.g. ["p1","p2"]
    status: varchar('status', { length: 255 }).notNull().default('published'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    sortCreatedIdx: index('idx_galrc_collections_sort_created').on(
      table.sortOrder,
      table.createdAt,
    ),
  }),
)

// galrc_collection_entries
export const collectionEntries = pgTable(
  'galrc_collection_entries',
  {
    id: serial('id').notNull().primaryKey(),
    collectionId: integer('collection_id').notNull(),
    vid: varchar('vid', { length: 255 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    collectionIdIdx: index('idx_collection_entries_collection_id').on(
      table.collectionId,
    ),
    vidIdx: index('idx_collection_entries_vid').on(table.vid),
  }),
)

// galrc_event_views — 页面访问事件（替代 Umami）
export const eventViews = pgTable(
  'galrc_event_views',
  {
    id: serial('id').primaryKey().notNull(),
    eventType: varchar('event_type', { length: 20 }).notNull(),
    targetId: varchar('target_id', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    eventTypeCreatedAtIdx: index('idx_galrc_event_views_type_created').on(
      table.eventType,
      table.createdAt,
    ),
    eventTypeTargetIdx: index('idx_galrc_event_views_type_target').on(
      table.eventType,
      table.targetId,
    ),
  }),
)

export const collectionsRelations = relations(collections, ({ many }) => ({
  entries: many(collectionEntries),
}))

export const collectionEntriesRelations = relations(
  collectionEntries,
  ({ one }) => ({
    collection: one(collections, {
      fields: [collectionEntries.collectionId],
      references: [collections.id],
    }),
  }),
)
