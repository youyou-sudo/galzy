import { relations } from 'drizzle-orm'
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
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
    createdAtGameIdIdx: index('idx_galrc_game_download_stats_created_game').on(
      table.createdAt,
      table.gameId,
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
    statusIdx: index('idx_galrc_collections_status').on(table.status),
    typeIdx: index('idx_galrc_collections_type').on(table.type),
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
    // 合集详情/预览都按 (collection_id) 过滤后 ORDER BY sort_order；
    // 组合索引让排序也能走索引（顶替原单列索引）。
    collectionIdSortIdx: index('idx_collection_entries_collection_sort').on(
      table.collectionId,
      table.sortOrder,
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

// galrc_stat_counters — 明细表被 TTL 清理后，累计计数落在这里。
//
// galrc_event_views / galrc_gameDownloadStats 既是「时间窗口排行榜」的数据源，
// 也是「累计浏览量 / 累计下载次数」的数据源。前者只需要近期数据，后者的语义是
// 终身累计。清理明细前先把即将删除的行按 (kind, target_id) 聚合进本表，
// 读取侧的累计值 = 本表 total + 明细表剩余行数，于是明细可以安全 TTL 清理而
// 累计数不下降（见 modules/tasks/service.ts 的 rollupAndPrune* 与 libs/stats.ts）。
export const statCounters = pgTable(
  'galrc_stat_counters',
  {
    /** 计数维度：'game_view' | 'tag_view' | 'game_download'（与 event_type 对齐）。 */
    kind: varchar('kind', { length: 32 }).notNull(),
    /** 计数对象：gameId / tagId / otherId。 */
    targetId: varchar('target_id', { length: 255 }).notNull(),
    total: bigint('total', { mode: 'number' }).notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.kind, table.targetId] }),
  }),
)

export const collectionEntriesRelations = relations(
  collectionEntries,
  ({ one }) => ({
    collection: one(collections, {
      fields: [collectionEntries.collectionId],
      references: [collections.id],
    }),
  }),
)

// galrc_friend_links — 友情链接（前台展示，后台可增删 / 拖动排序）
export const friendLinks = pgTable(
  'galrc_friend_links',
  {
    id: serial('id').notNull().primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    avatar: text('avatar'),
    href: text('href').notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // 列表固定 ORDER BY sort_order, id：组合索引让排序走索引，避免额外 sort。
    sortIdx: index('idx_galrc_friend_links_sort').on(table.sortOrder, table.id),
  }),
)

// galrc_ad_slots — 广告位（展示位置配置）
//
// 行业通用模型：广告位（Slot）只描述「展示在哪里、同屏几条、手机端怎么排」，
// 素材（Creative，见下方 galrc_adverts）描述「展示什么、什么时候、给谁看」。
// key 是模板调用标识（如 home_top），同时也是公开接口 GET /adverts/slot/:key
// 的路由参数，因此前后台共用且必须唯一；改文案用 name，不要动 key。
export const adSlots = pgTable(
  'galrc_ad_slots',
  {
    id: serial('id').notNull().primaryKey(),
    /** 模板调用标识：^[a-z][a-z0-9_]{1,63}$（应用层校验），唯一。 */
    key: varchar('key', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    /** 同一轮最多展示几条素材：桌面并排 / 手机轮播的条数（应用层 1..4）。 */
    maxItems: integer('max_items').notNull().default(1),
    /** 手机端展示方式：carousel | stack | hidden（应用层枚举校验）。 */
    mobileMode: varchar('mobile_mode', { length: 16 })
      .notNull()
      .default('carousel'),
    /** 手机端自动轮播间隔（秒），0 = 不自动切换（应用层 0..60）。 */
    carouselInterval: integer('carousel_interval').notNull().default(5),
    /** 停用后该广告位整体不下发（公开接口返回 null），素材不受影响。 */
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    keyIdx: uniqueIndex('uq_galrc_ad_slots_key').on(table.key),
  }),
)

// galrc_adverts — 广告素材（图片 + 链接 + 排期 + 设备定向 + 权重 + 统计）
//
// name 同时承担三个身份：后台列表里的识别名、前台 <img alt>、umami 事件名，
// 因此不做唯一约束但必须非空；description 只是后台备注，前台永不展示。
// image 允许站内相对路径（/dzmm.webp）与 https 外链，href 只允许 http(s)。
export const adverts = pgTable(
  'galrc_adverts',
  {
    id: serial('id').notNull().primaryKey(),
    /** 归属广告位；删除广告位时级联删除其下素材。 */
    slotId: integer('slot_id')
      .notNull()
      .references(() => adSlots.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    image: text('image').notNull(),
    href: text('href').notNull(),
    description: text('description'),
    /** 前台是否展示：停用后仍留在后台列表里，只是公开接口读不到（status=paused）。 */
    enabled: boolean('enabled').notNull().default(true),
    /** 设备定向：all | desktop | mobile。 */
    device: varchar('device', { length: 16 }).notNull().default('all'),
    /** 权重：候选多于 maxItems 时按权重不放回随机抽取（应用层 0..10000）。 */
    weight: integer('weight').notNull().default(10),
    /** 排期开始，NULL = 立即生效；start_at > now() 时 status=scheduled。 */
    startAt: timestamp('start_at', { withTimezone: true }),
    /** 排期结束，NULL = 长期投放；end_at < now() 时 status=expired。 */
    endAt: timestamp('end_at', { withTimezone: true }),
    sortOrder: integer('sort_order').notNull().default(0),
    /** 曝光 / 点击计数：POST /adverts/track 直接自增，不影响缓存。 */
    impressions: bigint('impressions', { mode: 'number' }).notNull().default(0),
    clicks: bigint('clicks', { mode: 'number' }).notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    // 公开读固定 WHERE slot_id = ? AND ... ORDER BY sort_order, id；
    // 后台列表固定 ORDER BY slot_id, sort_order, id。
    // 组合索引让「按位过滤 + 排序」走同一个索引，顶替旧的全表 sort 索引。
    slotSortIdx: index('idx_galrc_adverts_slot_sort').on(
      table.slotId,
      table.sortOrder,
    ),
  }),
)
