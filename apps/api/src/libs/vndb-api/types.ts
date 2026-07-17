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
  released: string | null
}

export interface VnTitle {
  lang: string
  title: string
  latin: string | null
  official: boolean
  main: boolean
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
  relations: ProducerRelation[]
}

export interface ProducerRelation {
  relation: string
  id: string
  name: string
  original: string | null
}
