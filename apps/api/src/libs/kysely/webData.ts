import { dbConfig } from '@api/libs/config'
import {
  type ColumnType,
  type Generated,
  Kysely,
  PostgresDialect,
} from 'kysely'
import { Pool } from 'pg'

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

export interface ArticlesTable {
  id: Generated<number>
  vid: string | null
  otherid: number | null
  title: string | null
  content: string | null
  type: ArticleType
  copyright: string | null
  createdAt: ColumnType<Date, string | undefined, never>
  updatedAt: ColumnType<Date, string | undefined, never>
}


// vndb
export interface TagsVnTable {
  updatedAt: ColumnType<Date, string | undefined, never>
  tag: string
  vid: string
  uid?: string | null
  vote: number
  spoiler?: number | null
  ignore: boolean
  lie?: boolean | null
  notes: string
}


// VNDB data
export interface VnTable {
  id: string
  image: string | null // Deprecated, marked as nullable
  c_image: string | null // vndbid(cv) - assuming cv means character varying
  olang: string // language type
  c_votecount: number
  c_rating: number | null // smallint, nullable
  c_average: number | null // smallint, nullable
  length: number // smallint (0-5)
  devstatus: number // smallint (0-2)
  alias: string // text, nullable
  description: string // text, nullable
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
}

export interface ImagesTable {
  id: string
  width: number
  height: number
  c_votecount: number
  c_sexual_avg: number
  c_sexual_stddev: number
  c_violence_avg: number
  c_violence_stddev: number
  c_weight: number
}

type tag_category = 'cont' | 'ero' | 'tech'

export interface TagsTable {
  id: string
  cat: tag_category
  defaultspoil: number
  searchable: boolean
  applicable: boolean
  name: string
  alias: string
  description: string
}

export interface TagsVnTable {
  tag: string
  vid: string
  uid?: string | null
  vote: number
  spoiler?: number | null
  ignore: boolean
  lie?: boolean | null
  notes: string
}

export interface ReleasesTable {
  id: string
  gtin: bigint
  olang: language
  released: number
  voiced: number
  reso_x: number
  reso_y: number
  minage: number | null
  ani_story: number
  ani_ero: number
  ani_story_sp: number | null
  ani_story_cg: number | null
  ani_cutscene: number | null
  ani_ero_sp: number | null
  ani_ero_cg: number | null
  ani_bg: boolean | null
  ani_face: boolean | null
  has_ero: boolean
  patch: boolean
  freeware: boolean
  uncensored: boolean | null
  official: boolean
  catalog: string
  engine: string
  notes: string
  title: string | null
}

export interface ReleasesVnTable {
  id: string
  vid: string
}

export interface ReleasesTitlesTable {
  id: string // 主键，自增
  lang: language // 语言代码（如 'en', 'ja' 等）
  mtl: boolean // 是否为 machine-translated
  title: string | null // 可为空
  latin: string | null // 可为空
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
}

const dialect = new PostgresDialect({
  pool: new Pool(dbConfig),
})

export const db = new Kysely<Database>({
  dialect,
})

export { sql } from 'kysely'
