import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
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
    coverThumbhash: text('cover_thumbhash'),
    intro: text('intro'), // 最佳简介（zh-Hans → zh → en → 首条，同步时裁定）
    localized: jsonb('localized'), // 原始 localized 块 { lang: { value, kind, machine? } }
    covers: jsonb('covers'), // 原始 covers 数组（含 url、宽高、thumbhash 等字段）
    intros: jsonb('intros'), // 原始 intros 数组 [{ lang, intro }]
    ratings: jsonb('ratings'), // 原始跨源评分数组 [{ source, score, vote_count, rank? }]
    refs: jsonb('refs'), // 原始精确锚点数组 [{ source, external_id }]
    syncedAt: timestamp('synced_at', { withTimezone: true }),
  },
  (table) => ({
    // 唯一：vndb_id 是对齐锚点，多处（Meili 索引构建、列表排序、详情合并）
    // 用 `(SELECT … WHERE kw.vndb_id = vn.id)` 标量子查询消费；一旦同一锚点
    // 出现多行，标量子查询会抛 21000 并整体打断索引构建，故必须唯一。
    // 可空列在 PG 唯一索引下允许多个 NULL（无 vndb 锚点的作品不受影响）。
    vndbIdIdx: uniqueIndex('idx_galrc_kungal_works_vndb_id').on(table.vndbId),
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

// galrc_kungal_characters — 鲲 Galgame 目录的角色（第二数据源的角色主表）
// 角色只从 kungal API 取，不以 VNDB 为数据源：vndb 只在作品层做锚点映射
// （galrc_kungal_works.vndb_id），不参与角色字段。角色 id 是 kungal catalog id，
// 与 VNDB 的 cNNN 不是同一命名空间，不能混用。
//
// traits 故意只存原始 JSON 数组（不建词表、不合并 id）：kungal 的 trait 词表
// 直通 VNDB trait（vndb_tid），但两边尚未对齐，先原样落库留待后续人工合并；
// 现在建词表只会把「待合并」变成「两套 id 并存」，更难收口。
export const kungalCharacters = pgTable('galrc_kungal_characters', {
  id: text('id').primaryKey(), // NextMoe catalog character id（十进制字符串）
  displayName: text('display_name').notNull(), // 主显示名，恒非空
  latin: text('latin'),
  lang: text('lang'), // display_name 的 BCP-47 语言，可空
  localized: jsonb('localized'), // 原始 localized 块 { lang: { value, is_machine? } }
  gender: text('gender'), // male | female | other
  birthday: text('birthday'), // MM-DD（无年份，不是日期）
  bloodType: text('blood_type'), // a | b | ab | o
  heightCm: integer('height_cm'),
  weightKg: integer('weight_kg'),
  // measurements 原样存 jsonb：{ bust_cm, waist_cm, hip_cm, cup }。
  // cup 是文本而三围是整数，拆成四列后每次读取都要拼回对象，且 kungal 若
  // 加键（如 body_type）还得再迁移；展示层只用其中三项，jsonb 足够。
  measurements: jsonb('measurements'),
  // 图片独立列（url/宽/高/thumbhash）：列表页与卡片直接消费，避免每行都
  // 从 jsonb 里解构。image 原始块另存一份，因为还带 hash/sexual/source 等
  // 后续审核与图片代理需要的字段。
  imageUrl: text('image_url'),
  imageWidth: integer('image_width'),
  imageHeight: integer('image_height'),
  imageThumbhash: text('image_thumbhash'),
  image: jsonb('image'),
  // figure 是全身立绘（未裁剪），列表不用；先原样存下，避免以后想看时
  // 必须重新全量同步一次。
  figure: jsonb('figure'),
  intro: text('intro'), // 最佳简介（zh-Hans → zh → ja → en → 首条，同步时裁定）
  intros: jsonb('intros'), // 原始 intros 数组 [{ lang, value, is_machine, source }]
  instanceOfId: text('instance_of_id'), // 该行是另一个角色的「实例」时指向源角色
  // 原始 CharacterTrait 数组（不合并、不建词表）。
  // 口径说明：同步走 /catalog/characters?ids= 批量通道，该通道**没有 spoiler
  // 参数**，traits 默认天花板是 spoiler=none —— 所以库里只有「无剧透」属性，
  // minor/major 级不在其中（要全量得逐角色调 /characters/{id}?spoiler=major，
  // 没有批量通道）。这是有意取舍：角色卡默认不展示剧透属性，需要时可按需补齐。
  traits: jsonb('traits'),
  refs: jsonb('refs'), // 原始跨源锚点 [{ source, external_id }]
  syncedAt: timestamp('synced_at', { withTimezone: true }),
})

// galrc_kungal_character_appearances — 角色 × 作品名册（谁在哪部作品出场、戏份与剧透级）
// 复合主键 (character_id, work_id)：同一角色在一部作品里只应有一行名册记录；
// 上游若出现重复行，同步侧按主键去重（否则 ON CONFLICT 同语句二次命中报 21000）。
export const kungalCharacterAppearances = pgTable(
  'galrc_kungal_character_appearances',
  {
    characterId: text('character_id')
      .notNull()
      .references(() => kungalCharacters.id, { onDelete: 'cascade' }),
    workId: text('work_id')
      .notNull()
      .references(() => kungalWorks.id, { onDelete: 'cascade' }),
    rosterRole: text('roster_role'), // main | secondary | appears | unknown
    spoiler: text('spoiler'), // none | minor | major
    // 上游名册的顺序（游标翻页时的第几条）。roster_role 不唯一，只按它排序
    // 无法稳定翻页/展示，故保留原始序号作为同档内的次序。
    sortOrder: integer('sort_order'),
    syncedAt: timestamp('synced_at', { withTimezone: true }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.characterId, table.workId] }),
    // 作品页要把名册按戏份取出来，这条索引直接覆盖 (work_id) 等值 + 同档排序。
    workRosterIdx: index('idx_galrc_kungal_character_appearances_work').on(
      table.workId,
      table.rosterRole,
      table.sortOrder,
    ),
  }),
)

// galrc_kungal_walkthroughs — 鲲 Galgame 目录的攻略（walkthrough，v2 /catalog/walkthroughs）
// 一行 = 一条攻略（同一作品可能有日文原版 + 汉化版 + 不同作者的多条，id 全局唯一）。
// work_id 指向 galrc_kungal_works：攻略没有独立的展示身份，永远跟着作品页走，
// 作品被删时整行级联删除（否则会留下指向不存在作品的孤儿攻略）。
//
// chart 为什么整块 jsonb，不拆成 sections / segments / steps 表：
// 1) chart 是一棵闭合的图（entry/save/ending 节点 + segment 边的 key 互相引用），
//    拆表后每次详情读取都要多表 JOIN 再在内存里重建成同一棵树，读侧没有收益；
// 2) 本系统对 chart **只读**：不做按 step 的检索、统计或编辑，也没有「查某个
//    选项」这类需求，拆表带来的索引能力用不上；
// 3) 上游仍在演进（v2 把 steps 从 segment 内联改成数组就换过形状，spec 里每个
//    对象都是 additionalProperties=true）。整块透传时新增字段自动落库，前端按
//    snake_case 原样消费；拆表则每次上游加键都要一次迁移 + 回填。
// 代价是 chart 不能按字段过滤 —— 需要时再用 jsonb 路径表达式，不影响现在的
// 「按 work 取单行、原样透传给前端」这条唯一读取路径。
export const kungalWalkthroughs = pgTable(
  'galrc_kungal_walkthroughs',
  {
    id: text('id').primaryKey(), // NextMoe catalog walkthrough id（十进制字符串）
    workId: text('work_id')
      .notNull()
      .references(() => kungalWorks.id, { onDelete: 'cascade' }),
    lang: text('lang'), // 攻略正文语言（BCP-47：ja / zh-Hans…）
    // source 是开放词汇（来源站名，或 nextmoe = 平台自写），只做展示与署名，
    // **不能**当判别字段用（上游 spec 明确写了 "Must not be used as a discriminant"）。
    source: text('source'),
    sourceUrl: text('source_url'), // 原页面地址（署名外链）；自写攻略为空
    sourceAuthor: text('source_author'), // 原页面署名作者，可能为空
    sourceUpdatedOn: text('source_updated_on'), // 原页面自称的更新日期（YYYY-MM-DD，非时间戳）
    workContentLimit: text('work_content_limit'), // 作品的展示轴 sfw | nsfw（与 nsfw 年龄轴无关）
    workRouteHints: boolean('work_route_hints'), // 游戏自带路线提示（前端要先说明）
    // release / characters 都是「一次读完、原样透传」的小块：
    // release 是攻略对应的发行版（官方/汉化补丁），characters 是 chart 里的
    // 角色 key 表（key → 目录角色）。它们与 chart 同生命周期、同一个请求返回，
    // 拆表同样只增加 JOIN，故一并 jsonb。
    release: jsonb('release'), // 原始 WalkthroughRelease 块，或 null
    characters: jsonb('characters'), // 原始 WalkthroughCharacter 数组
    chart: jsonb('chart'), // 原始 WalkthroughChart 块（列表接口不带，详情才拉）
    // 三个计数是列表页要显示的标量（「12 个结局 / 8 个存档点」），从 chart 里
    // 提前算好单独存列：列表页不读 chart，否则每次都把整棵图搬进内存。
    endingCount: integer('ending_count'),
    saveCount: integer('save_count'),
    segmentCount: integer('segment_count'),
    // 上游行的 updated_at：同步时用它判断「这条攻略有没有变」，没变就跳过
    // 详情请求（chart 很大，全量重拉一遍的代价远高于列表翻页）。
    upstreamUpdatedAt: timestamp('upstream_updated_at', { withTimezone: true }),
    syncedAt: timestamp('synced_at', { withTimezone: true }),
  },
  (table) => ({
    // 作品页/详情页唯一的读取路径是「按 work 取该作品全部攻略，按上游更新时间倒序」。
    // 复合索引同时覆盖等值过滤与排序，省掉一次 sort。
    workIdx: index('idx_galrc_kungal_walkthroughs_work').on(
      table.workId,
      table.upstreamUpdatedAt,
    ),
  }),
)
