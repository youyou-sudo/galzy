import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// galrc_kungal_works — 鲲 Galgame（NextMoe·未萌）目录作品（第二数据源，显示优先级高于 VNDB）
// 同一部作品在六个源各有一个页面，NextMoe 对齐成一条记录并给出裁定后的标准答案。
// 本表存储 works-list 行（include=names,intros,covers,ratings,refs）的规范化标量 + 原始块。
// vndb_id 为对齐锚点（如 'v19658'），与 vn.id 关联：kungal 有记录 → 显示 kungal，否则回退 vndb。
export const kungalWorks = pgTable(
  'galrc_kungal_works',
  {
    id: text('id').primaryKey(), // NextMoe catalog work id
    vndbId: text('vndb_id'), // VNDB 锚点（refs 中 source=vndb 且 external_id 形如 vNNN），可空 = 无 vndb 锚点
    olang: text('olang'),
    medium: text('medium'),
    contentRating: text('content_rating'), // all_ages | sensitive | r18
    releasedFirst: text('released_first'), // 每作品最早发售日（release_date，与日历同一锚点）
    displayName: text('display_name'), // 主显示名（localized[olang]）
    coverUrl: text('cover_url'), // 竖版封面 portrait url（显示/索引直接使用，避免 jsonb 提取）
    coverWidth: integer('cover_width'),
    coverHeight: integer('cover_height'),
    intro: text('intro'), // 最佳简介（zh-Hans → zh → en → 首条，同步时裁定）
    localized: jsonb('localized'), // 原始 localized 块 { lang: { value, kind, machine? } }
    covers: jsonb('covers'), // 原始 covers 块 { portrait: {url,width,height,thumbhash,sexual,violence,source}, banner: {...} }
    intros: jsonb('intros'), // 原始 intros 数组 [{ lang, intro }]
    ratings: jsonb('ratings'), // 原始跨源评分数组 [{ source, score, vote_count, rank? }]
    refs: jsonb('refs'), // 原始精确锚点数组 [{ source, external_id }]
    syncedAt: timestamp('synced_at', { withTimezone: true }),
  },
  (table) => ({
    vndbIdIdx: index('idx_galrc_kungal_works_vndb_id').on(table.vndbId),
  }),
)

// galrc_kungal_work_titles — 各语言标题（localized 块规范化行，形状对齐 vn_titles）
export const kungalWorkTitles = pgTable(
  'galrc_kungal_work_titles',
  {
    workId: text('work_id')
      .notNull()
      .references(() => kungalWorks.id, { onDelete: 'cascade' }),
    lang: text('lang'),
    official: boolean('official'),
    title: text('title'),
    latin: text('latin'),
    main: boolean('main'),
  },
  (table) => ({
    workIdIdx: index('idx_galrc_kungal_work_titles_work_id').on(table.workId),
    workIdLangTitleIdx: uniqueIndex('idx_galrc_kungal_work_titles_uniq').on(
      table.workId,
      table.lang,
      table.title,
    ),
  }),
)
