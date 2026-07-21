import { pgTable, text, integer, boolean, real, timestamp, smallint, bigint, index } from 'drizzle-orm/pg-core'

// vn — 视觉小说
export const vn = pgTable('vn', {
  id: text('id').primaryKey(),
  image: text('image'),
  cImage: text('c_image'),
  imageUrl: text('image_url'),
  olang: text('olang'),
  cVotecount: integer('c_votecount'),
  cRating: real('c_rating'),
  cAverage: real('c_average'),
  length: smallint('length'),
  devstatus: smallint('devstatus'),
  alias: text('alias'),
  description: text('description'),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
}, (table) => ({
  olangIdx: index('idx_vn_olang').on(table.olang),
  devstatusIdx: index('idx_vn_devstatus').on(table.devstatus),
}))

// vn_titles
export const vnTitles = pgTable('vn_titles', {
  id: text('id'),
  lang: text('lang'),
  official: boolean('official'),
  title: text('title'),
  latin: text('latin'),
  main: boolean('main'),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
}, (table) => ({
  idIdx: index('idx_vn_titles_id').on(table.id),
  langIdx: index('idx_vn_titles_lang').on(table.lang),
  mainIdx: index('idx_vn_titles_main').on(table.main),
}))

// images
export const images = pgTable('images', {
  id: text('id').primaryKey(),
  url: text('url'),
  width: integer('width'),
  height: integer('height'),
  cVotecount: integer('c_votecount'),
  cSexualAvg: real('c_sexual_avg'),
  cSexualStddev: real('c_sexual_stddev'),
  cViolenceAvg: real('c_violence_avg'),
  cViolenceStddev: real('c_violence_stddev'),
  cWeight: real('c_weight'),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
})

// tags
export const tags = pgTable('tags', {
  id: text('id').primaryKey(),
  cat: text('cat'),
  defaultspoil: smallint('defaultspoil'),
  searchable: boolean('searchable'),
  applicable: boolean('applicable'),
  name: text('name'),
  alias: text('alias'),
  description: text('description'),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
}, (table) => ({
  catIdx: index('idx_tags_cat').on(table.cat),
}))

// tags_vn
export const tagsVn = pgTable('tags_vn', {
  tag: text('tag'),
  vid: text('vid'),
  uid: text('uid'),
  vote: integer('vote'),
  spoiler: integer('spoiler'),
  ignore: boolean('ignore'),
  lie: boolean('lie'),
  notes: text('notes'),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
}, (table) => ({
  tagIdx: index('idx_tags_vn_tag').on(table.tag),
  vidIdx: index('idx_tags_vn_vid').on(table.vid),
  uidIdx: index('idx_tags_vn_uid').on(table.uid),
}))

// releases
export const releases = pgTable('releases', {
  id: text('id').primaryKey(),
  gtin: bigint('gtin', { mode: 'number' }),
  olang: text('olang'),
  released: text('released'),
  voiced: integer('voiced'),
  resoX: integer('reso_x'),
  resoY: integer('reso_y'),
  minage: smallint('minage'),
  aniStory: smallint('ani_story'),
  aniEro: smallint('ani_ero'),
  aniStorySp: smallint('ani_story_sp'),
  aniStoryCg: smallint('ani_story_cg'),
  aniCutscene: smallint('ani_cutscene'),
  aniEroSp: smallint('ani_ero_sp'),
  aniEroCg: smallint('ani_ero_cg'),
  aniBg: boolean('ani_bg'),
  aniFace: boolean('ani_face'),
  hasEro: boolean('has_ero'),
  patch: boolean('patch'),
  freeware: boolean('freeware'),
  uncensored: boolean('uncensored'),
  official: boolean('official'),
  catalog: text('catalog'),
  engine: text('engine'),
  notes: text('notes'),
  title: text('title'),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
}, (table) => ({
  olangIdx: index('idx_releases_olang').on(table.olang),
}))

// releases_vn
export const releasesVn = pgTable('releases_vn', {
  id: text('id'),
  vid: text('vid'),
  rtype: text('rtype'),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
}, (table) => ({
  idIdx: index('idx_releases_vn_id').on(table.id),
  vidIdx: index('idx_releases_vn_vid').on(table.vid),
}))

// releases_titles
export const releasesTitles = pgTable('releases_titles', {
  id: text('id'),
  lang: text('lang'),
  mtl: boolean('mtl'),
  title: text('title'),
  latin: text('latin'),
  main: boolean('main'),
}, (table) => ({
  idIdx: index('idx_releases_titles_id').on(table.id),
  langIdx: index('idx_releases_titles_lang').on(table.lang),
}))

// releases_producers
export const releasesProducers = pgTable('releases_producers', {
  id: text('id'),
  pid: text('pid'),
  developer: boolean('developer'),
  publisher: boolean('publisher'),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
}, (table) => ({
  idIdx: index('idx_releases_producers_id').on(table.id),
  pidIdx: index('idx_releases_producers_pid').on(table.pid),
}))

// producers
export const producers = pgTable('producers', {
  id: text('id').primaryKey(),
  type: text('type'),
  lang: text('lang'),
  name: text('name'),
  latin: text('latin'),
  original: text('original'),
  alias: text('alias'),
  description: text('description'),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
}, (table) => ({
  typeIdx: index('idx_producers_type').on(table.type),
  langIdx: index('idx_producers_lang').on(table.lang),
}))

// producers_relations
export const producersRelations = pgTable('producers_relations', {
  id: text('id'),
  pid: text('pid'),
  relation: text('relation'),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
}, (table) => ({
  idIdx: index('idx_producers_relations_id').on(table.id),
  pidIdx: index('idx_producers_relations_pid').on(table.pid),
}))

import { relations } from 'drizzle-orm'

export const vnRelations = relations(vn, ({ many, one }) => ({
  titles: many(vnTitles, { relationName: 'vnTitles' }),
  image: one(images, {
    fields: [vn.cImage],
    references: [images.id],
    relationName: 'vnImage',
  }),
}))

export const vnTitlesRelations = relations(vnTitles, ({ one }) => ({
  vn: one(vn, {
    fields: [vnTitles.id],
    references: [vn.id],
    relationName: 'vnTitles',
  }),
}))
