// ====== 通用请求/响应 ======
export type VndbFilter =
  | [string, string, unknown]
  | ['and' | 'or', ...VndbFilter[]]

export interface VndbQuery {
  filters: VndbFilter
  fields: string
  sort?: string
  results?: number
  page?: number
  count?: boolean
}

export interface VndbResponse<T> {
  results: T[]
  more: boolean
}

// ====== VN ======
export interface VnResult {
  id: string
  olang: string
  length: number | null
  devstatus: number
  description: string | null
  rating: number | null
  votecount: number
  average: number | null
  aliases: string[]
  titles: VnTitle[]
  image: VnImage | null
  tags: VnTag[]
  relations: VnRelation[]
  released: string | null
}

export interface VnTitle {
  lang: string
  title: string
  latin: string | null
  official: boolean
  main: boolean
}

export interface VnRelation {
  id: string
  relation: string
  relation_official: boolean
  title: string
}

export interface VnImage {
  id: string
  url: string
  dims: [number, number]
  sexual: number
  violence: number
  votecount: number
}

export interface VnTag {
  id: string
  rating: number
  spoiler: number
  lie: boolean
}

// ====== Tag ======
export interface TagResult {
  id: string
  name: string
  aliases: string[]
  description: string
  category: 'cont' | 'ero' | 'tech'
  searchable: boolean
  applicable: boolean
  vn_count: number
}

// ====== Tag dump（层级唯一来源）======
//
// Kuna API 的 POST /tag 不返回层级信息（parent/parents/meta 均不在 schema 中），
// 只有官方 dump 带 parents/meta。dump 的 id 是裸整数，与 API 的 "gN" 对应关系为
// `g${id}`，同步时需要转换。
export interface TagDumpEntry {
  id: number
  name: string
  cat: 'cont' | 'ero' | 'tech'
  description: string
  aliases: string[]
  searchable: boolean
  applicable: boolean
  vns: number
  /** meta=true 的组织节点（含 5 个根标签 Theme/Character/Setting/Plot/Style）*/
  meta: boolean
  /** 祖先标签的裸整数 id 数组；DAG 中可能有多个 */
  parents: number[]
}

// ====== Release ======
export interface ReleaseResult {
  id: string
  title: string
  released: string | null
  minage: number | null
  patch: boolean
  freeware: boolean
  uncensored: boolean | null
  official: boolean
  has_ero: boolean
  engine: string | null
  voiced: number
  gtin: string | null
  catalog: string | null
  notes: string | null
  languages: ReleaseLanguage[]
  vns: ReleaseVnRef[]
  producers: ReleaseProducerRef[]
}

export interface ReleaseLanguage {
  lang: string
  title: string | null
  latin: string | null
  mtl: boolean
  main: boolean
}

export interface ReleaseVnRef {
  id: string
  rtype: string
}

export interface ReleaseProducerRef {
  id: string
  developer: boolean
  publisher: boolean
  name: string
  original: string | null
}

// ====== Producer ======
export interface ProducerResult {
  id: string
  name: string
  original: string | null
  aliases: string[]
  lang: string
  type: 'co' | 'in' | 'ng'
  description: string | null
}
