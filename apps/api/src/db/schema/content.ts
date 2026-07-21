import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, serial, bigint } from 'drizzle-orm/pg-core'
import { sql, relations } from 'drizzle-orm'
import { vn } from './vndb'

// galrc_other — 非VNDB条目
export const others = pgTable('galrc_other', {
  id: serial('id').primaryKey(),
  title: jsonb('title'),
  alias: text('alias'),
  introduction: text('introduction'),
  description: text('description'),
  status: text('status'),
})

// galrc_media — 媒体文件
export const media = pgTable('galrc_media', {
  hash: text('hash').primaryKey(),
  name: text('name').notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  type: varchar('type', { length: 255 }).notNull(),
  cover: boolean('cover').notNull().default(false),
  thumbHash: text('thumb_hash'),
})

// galrc_other_media — 条目-媒体关联
export const otherMedia = pgTable('galrc_other_media', {
  id: serial('id').primaryKey(),
  otherId: integer('other_id').notNull().references(() => others.id, { onDelete: 'cascade' }),
  mediaHash: text('media_hash').notNull().references(() => media.hash, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).defaultNow(),
  cover: boolean('cover').notNull().default(false),
})

// galrc_alistb — Alist条目关联
export const alistb = pgTable('galrc_alistb', {
  id: varchar('id', { length: 512 }).notNull().primaryKey(),
  vid: varchar('vid', { length: 255 }),
  other: bigint('other', { mode: 'number' }),
  path: jsonb('path'),
})

// galrc_article — 文章
export const articles = pgTable('galrc_article', {
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
})

// galrc_zhtag — 中文标签
export const zhtags = pgTable('galrc_zhtag', {
  id: varchar('id', { length: 255 }).notNull().primaryKey(),
  name: text('name'),
  alias: text('alias'),
  description: text('description'),
  exhibition: boolean('exhibition').notNull().default(true),
})

// galrc_comments — 评论
export const comments = pgTable('galrc_comments', {
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
})

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
