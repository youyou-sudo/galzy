import { dbConfig, vndbDbConfig } from '@api/libs/config'
import {
  type ColumnType,
  type Generated,
  Kysely,
  PostgresDialect,
} from 'kysely'
import { Pool } from 'pg'

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
  l_renai: string // text, nullable
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

export interface VndbDatabase {
  // VNDB data
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
  pool: new Pool(vndbDbConfig),
})

export const vndbDb = new Kysely<VndbDatabase>({
  dialect,
})
