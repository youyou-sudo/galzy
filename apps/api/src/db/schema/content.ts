import { relations, sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import { vn } from './vndb'

// galrc_other — 非VNDB条目
export const others = pgTable(
  'galrc_other',
  {
    id: serial('id').primaryKey(),
    title: jsonb('title'),
    alias: text('alias'),
    introduction: text('introduction'),
    description: text('description'),
    status: text('status'),
  },
  (table) => ({
    statusIdx: index('idx_galrc_other_status').on(table.status),
  }),
)

// galrc_media — 媒体文件
export const media = pgTable(
  'galrc_media',
  {
    hash: text('hash').primaryKey(),
    name: text('name').notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    type: varchar('type', { length: 255 }).notNull(),
    cover: boolean('cover').notNull().default(false),
    thumbHash: text('thumb_hash'),
  },
  (table) => ({
    typeIdx: index('idx_galrc_media_type').on(table.type),
    coverIdx: index('idx_galrc_media_cover').on(table.cover),
  }),
)

// galrc_other_media — 条目-媒体关联
export const otherMedia = pgTable(
  'galrc_other_media',
  {
    id: serial('id').primaryKey(),
    otherId: integer('other_id')
      .notNull()
      .references(() => others.id, { onDelete: 'cascade' }),
    mediaHash: text('media_hash')
      .notNull()
      .references(() => media.hash, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).defaultNow(),
    cover: boolean('cover').notNull().default(false),
  },
  (table) => ({
    otherIdIdx: index('idx_galrc_other_media_other_id').on(table.otherId),
    mediaHashIdx: index('idx_galrc_other_media_media_hash').on(table.mediaHash),
    sortOrderIdx: index('idx_galrc_other_media_sort_order').on(table.sortOrder),
    createdAtIdx: index('idx_galrc_other_media_created_at').on(table.createdAt),
  }),
)

// galrc_alistb — Alist条目关联
export const alistb = pgTable(
  'galrc_alistb',
  {
    id: varchar('id', { length: 512 }).notNull().primaryKey(),
    vid: varchar('vid', { length: 255 }),
    other: bigint('other', { mode: 'number' }),
    path: jsonb('path'),
  },
  (table) => ({
    vidIdx: index('idx_galrc_alistb_vid').on(table.vid),
    otherIdx: index('idx_galrc_alistb_other').on(table.other),
  }),
)

// galrc_article — 文章
export const articles = pgTable(
  'galrc_article',
  {
    id: serial('id').primaryKey(),
    vid: varchar('vid', { length: 255 }),
    otherid: bigint('otherid', { mode: 'number' }),
    author: text('author'),
    title: varchar('title', { length: 255 }),
    content: text('content'),
    copyright: text('copyright'),
    type: varchar('type', { length: 255 }),
    status: varchar('status', { length: 255 }).notNull().default('published'),
    createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    vidIdx: index('idx_galrc_article_vid').on(table.vid),
    otheridIdx: index('idx_galrc_article_otherid').on(table.otherid),
    authorIdx: index('idx_galrc_article_author').on(table.author),
    typeIdx: index('idx_galrc_article_type').on(table.type),
    statusIdx: index('idx_galrc_article_status').on(table.status),
    createdAtIdx: index('idx_galrc_article_created_at').on(table.createdAt),
  }),
)

// galrc_zhtag — 中文标签
export const zhtags = pgTable(
  'galrc_zhtag',
  {
    id: varchar('id', { length: 255 }).notNull().primaryKey(),
    name: text('name'),
    alias: text('alias'),
    description: text('description'),
    exhibition: boolean('exhibition').notNull().default(true),
  },
  (table) => ({
    exhibitionIdx: index('idx_galrc_zhtag_exhibition').on(table.exhibition),
  }),
)

// galrc_comments — 评论
export const comments = pgTable(
  'galrc_comments',
  {
    id: varchar('id', { length: 255 }).notNull().primaryKey(),
    targetType: varchar('targetType', { length: 255 }).notNull(),
    targetId: varchar('targetId', { length: 255 }).notNull(),
    userId: varchar('userId', { length: 255 }).notNull(),
    content: text('content').notNull(),
    type: varchar('type', { length: 255 }).notNull(),
    parentId: varchar('parentId', { length: 255 }).notNull(),
    rootId: varchar('rootId', { length: 255 }),
    depth: integer('depth').notNull(),
    replyToUserId: varchar('replyToUserId', { length: 255 }),
    status: varchar('status', { length: 255 }).notNull(),
    feedbackStatus: varchar('feedbackStatus', { length: 255 }),
    isPinned: boolean('isPinned').notNull(),
    isWhispers: boolean('isWhispers').notNull(),
    lastReplyAt: timestamp('lastReplyAt'),
    meta: jsonb('meta'),
    createdAt: timestamp('createdAt').notNull(),
    updatedAt: timestamp('updatedAt').notNull(),
    deletedAt: timestamp('deletedAt'),
  },
  (table) => ({
    targetIdx: index('idx_galrc_comments_target').on(
      table.targetType,
      table.targetId,
    ),
    userIdIdx: index('idx_galrc_comments_user_id').on(table.userId),
    parentIdIdx: index('idx_galrc_comments_parent_id').on(table.parentId),
    rootIdIdx: index('idx_galrc_comments_root_id').on(table.rootId),
    statusIdx: index('idx_galrc_comments_status').on(table.status),
    createdAtIdx: index('idx_galrc_comments_created_at').on(table.createdAt),
  }),
)

export const alistbRelations = relations(alistb, ({ one }) => ({
  vn: one(vn, {
    fields: [alistb.vid],
    references: [vn.id],
  }),
  other: one(others, {
    fields: [alistb.other],
    references: [others.id],
  }),
}))

export const othersRelations = relations(others, ({ many }) => ({
  alistbEntries: many(alistb),
  media: many(otherMedia, { relationName: 'otherMedia' }),
}))

export const otherMediaRelations = relations(otherMedia, ({ one }) => ({
  other: one(others, {
    fields: [otherMedia.otherId],
    references: [others.id],
    relationName: 'otherMedia',
  }),
  media: one(media, {
    fields: [otherMedia.mediaHash],
    references: [media.hash],
    relationName: 'otherMediaMedia',
  }),
}))

export const mediaRelations = relations(media, ({ many }) => ({
  otherMediaEntries: many(otherMedia),
}))
