import { dbConfig } from '@api/libs/config'
import { type ColumnType, type Generated, Kysely } from 'kysely'
import { BunPostgresDialect } from 'kysely-bun-sql'

// better 部分
export interface User {
  id: Generated<string>
  name: string
  email: string
  emailVerified: boolean
  image?: string | null
  role: ColumnType<'user' | 'admin', string | undefined, 'user' | 'admin'>
  banned: ColumnType<boolean, boolean | undefined, boolean>
  banReason?: string | null
  banExpires?: Date | null
  createdAt: ColumnType<Date, string | undefined, never>
  updatedAt: ColumnType<Date, string | undefined, never>
}

export interface Session {
  id: Generated<string>
  userId: string
  token: string
  expiresAt: ColumnType<Date, string | undefined, never>
  ipAddress?: string | null
  userAgent?: string | null
  impersonatedBy?: string | null
  createdAt: ColumnType<Date, string | undefined, never>
  updatedAt: ColumnType<Date, string | undefined, never>
}

export interface Account {
  id: Generated<string>
  userId: string
  accountId: string
  providerId: string
  accessToken?: string | null
  refreshToken?: string | null
  accessTokenExpiresAt?: Date | null
  refreshTokenExpiresAt?: Date | null
  scope?: string | null
  idToken?: string | null
  password?: string | null
  createdAt: ColumnType<Date, string | undefined, never>
  updatedAt: ColumnType<Date, string | undefined, never>
}

export interface Verification {
  id: Generated<string>
  identifier: string
  value: string
  expiresAt: Date
  createdAt: ColumnType<Date, string | undefined, never>
  updatedAt: ColumnType<Date, string | undefined, never>
}

// Galrc 部分
export interface AlistB {
  id: Generated<string>
  vid: string | null
  other: number | null
  path: string[] | null
}

// alist 部分
export interface AlsitSearchNodes {
  parent: string
  name: string
  is_dir: boolean
  size: bigint
}

export interface AlsitSettingItems {
  key: string
  value: ColumnType<Record<string, any>, string, string>
  help: string
  type: string
  options: string
  group: bigint
  flag: bigint
  index: bigint
}

export interface AlistStorages {
  id: Generated<bigint>
  mount_panth: string | null
  order: bigint | null
  driver: string | null
  cache_expiration: bigint | null
  status: string | null
  addition: string | null
  remark: string | null
  modified: ColumnType<Date, string | undefined, never>
  disabled: boolean | null
  disable_index: boolean | null
  enable_sign: boolean | null
  order_by: string | null
  order_direction: string | null
  extract_folder: string | null
  web_proxy: boolean | null
  webdav_policy: string | null
  proxy_range: boolean | null
  down_proxy_url: string | null
}

export interface TagsZhTable {
  id: string
  name: string | null
  alias: string | null
  description: string | null
  exhibition: boolean // 是否展示
}

export type otherTitle = {
  title: string // 标题
  lang: language // 标题语言
}

export interface Onthermeidia {
  hash: string // 文件哈希（唯一性去重）
  name: string // 媒体名称
  type: string // 媒体类型、
  width: number
  height: number
  thumb_hash: string | null // ThumbHash 占位图 base64
  size: bigint // 文件大小
}

export interface OtherDataTable {
  id: Generated<number> // 主键，自增
  title: otherTitle[] | null // 可为空
  alias: string | null // 别名
  Introduction: string | null // 简介
  description: string | null // 介绍
  status: ColumnType<
    | 'draft'
    | 'editing'
    | 'pending'
    | 'published'
    | 'archived'
    | 'deleted'
    | 'failed',
    string | undefined,
    | 'draft'
    | 'editing'
    | 'pending'
    | 'published'
    | 'archived'
    | 'deleted'
    | 'failed'
  > | null // 状态
}

export interface OtherDataMediaTable {
  id: Generated<number> // 主键，自增
  other_id: number // 关联 OtherDataTable 的 id
  media_hash: string // 关联 Onthermeidia 的 hash
  cover: boolean | null // 是否为封面
  sort_order: number // 排序顺序
  createdAt: ColumnType<Date, string | undefined, never>
  updatedAt: ColumnType<Date, string | undefined, never>
}

export interface SiteConfigTable {
  key: string
  config: ColumnType<Record<string, any>, string, string>
}

export interface CloudflareConfigTable {
  id: Generated<number>
  a_email: string
  a_key: string
  account_id: string
  woker_name: string
  url_endpoint: string
  state: Generated<boolean>
  enable: Generated<boolean>
  duration: Generated<number>
  errors: Generated<number>
  requests: Generated<number>
  responseBodySize: Generated<number>
  subrequests: Generated<number>
  updateTime: ColumnType<Date | null>
}

// 文章类型
//  strategy  : 策略
//  blog      : 博客
//  tutorial  : 教程
type ArticleType = 'strategy' | 'blog' | 'tutorial'
// 文章状态：published(已发布/已审核) hidden(隐藏) deleted(已删除)
type ArticleStatus = 'published' | 'hidden' | 'deleted'

export interface ArticlesTable {
  id: Generated<number>
  vid: string | null
  otherid: number | null
  author: string
  title: string | null
  content: string | null
  type: ArticleType
  status: ColumnType<ArticleStatus, string | undefined, ArticleStatus>
  copyright: string | null
  createdAt: ColumnType<Date, string | undefined, never>
  updatedAt: ColumnType<Date, string | undefined, never>
}

// 评论类型：普通评论、反馈、提问
export type CommentType = 'comment' | 'feedback' | 'question'
// 评论状态：正常、隐藏、已删除
export type CommentStatus = 'normal' | 'hidden' | 'deleted'
// 反馈处理状态：待处理、处理中、已解决、已驳回
export type FeedbackStatus = 'open' | 'processing' | 'resolved' | 'rejected'

export interface CommentsTable {
  id: Generated<string>
  targetType: 'post' | 'article' | 'game' // 评论所属区块
  targetId: string // 评论所属条目 ID，如 V1 game
  userId: string
  content: string
  type: CommentType // 评论类型
  parentId: string | null // 评论父级
  rootId: string | null // 评论根
  depth: number // 评论层级
  replyToUserId: string | null // 回复用户
  status: CommentStatus
  feedbackStatus: FeedbackStatus | null // 评论状态
  isPinned: boolean
  isWhispers: boolean
  lastReplyAt: ColumnType<Date | null, Date | null, Date | null>
  meta: Record<string, any> | null
  createdAt: ColumnType<Date, string | undefined, never>
  updatedAt: ColumnType<Date, string | undefined, never>
  deletedAt: ColumnType<Date | null, Date | null, Date | null>
}

// VNDB data — local tables synced from VNDB API
export interface VnTable {
  id: string
  image: string | null
  c_image: string | null
  image_url: string | null
  olang: language
  c_votecount: number
  c_rating: number | null
  c_average: number | null
  length: number
  devstatus: number
  alias: string | null
  description: string | null
  synced_at: Date | null
}

export type language =
  | 'ar'
  | 'be'
  | 'bg'
  | 'ca'
  | 'cs'
  | 'ck'
  | 'da'
  | 'de'
  | 'el'
  | 'en'
  | 'eo'
  | 'es'
  | 'eu'
  | 'fa'
  | 'fi'
  | 'fr'
  | 'ga'
  | 'gl'
  | 'gd'
  | 'he'
  | 'hi'
  | 'hr'
  | 'hu'
  | 'id'
  | 'it'
  | 'iu'
  | 'ja'
  | 'kk'
  | 'ko'
  | 'mk'
  | 'ms'
  | 'ne'
  | 'la'
  | 'lt'
  | 'lv'
  | 'nl'
  | 'no'
  | 'pl'
  | 'pt-pt'
  | 'pt-br'
  | 'ro'
  | 'ru'
  | 'sk'
  | 'sl'
  | 'sr'
  | 'sv'
  | 'ta'
  | 'th'
  | 'tr'
  | 'uk'
  | 'ur'
  | 'vi'
  | 'zh-Hans'
  | 'zh'

export interface VnTitlesTable {
  id: string
  lang: language
  official: boolean
  title: string
  latin: string | null
  main: boolean
  synced_at: Date | null
}

export interface ImagesTable {
  id: string
  url: string | null
  width: number
  height: number
  c_votecount: number
  c_sexual_avg: number
  c_sexual_stddev: number
  c_violence_avg: number
  c_violence_stddev: number
  c_weight: number
  synced_at: Date | null
}

type tag_category = 'cont' | 'ero' | 'tech'

export interface TagsTable {
  id: string
  cat: tag_category
  defaultspoil: number | null
  searchable: boolean
  applicable: boolean
  name: string
  alias: string
  description: string
  synced_at: Date | null
}

export interface TagsVnTable {
  tag: string
  vid: string
  uid?: string | null
  vote: number
  spoiler?: number | null
  ignore: boolean
  lie?: boolean | null
  notes: string | null
  synced_at: Date | null
}

export interface ReleasesTable {
  id: string
  gtin: bigint | null
  olang: language | null
  released: string | null
  voiced: number | null
  reso_x: number | null
  reso_y: number | null
  minage: number | null
  ani_story: number | null
  ani_ero: number | null
  ani_story_sp: number | null
  ani_story_cg: number | null
  ani_cutscene: number | null
  ani_ero_sp: number | null
  ani_ero_cg: number | null
  ani_bg: boolean | null
  ani_face: boolean | null
  has_ero: boolean | null
  patch: boolean | null
  freeware: boolean | null
  uncensored: boolean | null
  official: boolean | null
  catalog: string | null
  engine: string | null
  notes: string | null
  title: string | null
  synced_at: Date | null
}

export interface ReleasesVnTable {
  id: string
  vid: string
  rtype: string | null
  synced_at: Date | null
}

export interface ReleasesTitlesTable {
  id: string
  lang: language
  mtl: boolean
  title: string | null
  latin: string | null
  main: boolean
}

// vndb 条目组织关联表
export interface ReleasesProducersTable {
  id: string
  pid: string
  developer: boolean
  publisher: boolean
  synced_at: Date | null
}

type ProducerType = 'co' | 'in' | 'ng'

export interface ProducersTable {
  id: string
  type: ProducerType | null
  lang: language | null
  name: string
  latin: string | null
  original: string | null
  alias: string | null
  description: string | null
  synced_at: Date | null
}

type relation = 'old' | 'new' | 'sub' | 'par' | 'imp' | 'ipa' | 'spa' | 'ori'

export interface ProducersRelationsTable {
  id: string
  pid: string
  relation: relation
  synced_at: Date | null
}

export interface GameDownloadStats {
  id: Generated<number>
  game_id: string // VNDB 游戏 ID
  file_path: string // 下载的文件路径
  created_at: Date // 记录创建时间
}

// 合集系列部分
export interface Collections {
  id: Generated<number>
  title: string
  alias: string
  description: string
}
export interface CollectionsItems {
  id: Generated<number>
  collection_id: number
  game_id: string
}

export interface Database {
  // better 部分
  galrc_user: User
  galrc_session: Session
  galrc_account: Account
  galrc_verification: Verification

  // Galrc 部分
  galrc_zhtag: TagsZhTable
  galrc_article: ArticlesTable
  galrc_alistb: AlistB
  galrc_storages: AlistStorages
  galrc_other: OtherDataTable
  galrc_other_media: OtherDataMediaTable
  galrc_media: Onthermeidia
  galrc_cloudflare: CloudflareConfigTable
  galrc_siteConfig: SiteConfigTable
  galrc_gameDownloadStats: GameDownloadStats
  galrc_comments: CommentsTable

  // Alist 部分
  galrc_search_nodes: AlsitSearchNodes
  galrc_setting_items: AlsitSettingItems

  // VNDB 部分
  vn: VnTable
  vn_titles: VnTitlesTable
  images: ImagesTable
  tags: TagsTable
  tags_vn: TagsVnTable
  releases: ReleasesTable
  releases_vn: ReleasesVnTable
  releases_titles: ReleasesTitlesTable
  producers: ProducersTable
  releases_producers: ReleasesProducersTable
  producers_relations: ProducersRelationsTable
}

const dialect = new BunPostgresDialect(dbConfig)

export const db = new Kysely<Database>({
  dialect,
})

export { sql } from 'kysely'
