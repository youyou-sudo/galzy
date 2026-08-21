// NextMoe·未萌 开放 API（Kungalapi / 鲲 Galgame 数据）wire 类型
// 响应信封：{ code, message, data }；code === 0 为成功。

/** catalog works-list 行（include=names,intros,covers,ratings,refs 之后的部分字段） */
export interface KungalWorkItem {
  id: number | string
  display_name?: string | null
  localized?: Record<
    string,
    { value?: string; kind?: string; machine?: boolean }
  > | null
  intros?: Array<{ lang?: string; intro?: string }> | null
  covers?: {
    portrait?: {
      url?: string
      width?: number
      height?: number
      thumbhash?: string
      sexual?: number
      violence?: number
      source?: string
    }
    banner?: {
      url?: string
      width?: number
      height?: number
      thumbhash?: string
      sexual?: number
      violence?: number
      source?: string
    }
  } | null
  cover?: string | null
  ratings?: Array<{
    source?: string
    score?: number
    vote_count?: number
    rank?: number
  }> | null
  refs?: Array<{ source?: string; external_id?: string }> | null
  olang?: string | null
  medium?: string | null
  content_rating?: string | null
  release_date?: string | null
  claimed_by?: unknown
}

/** 目录 works 列表响应 data */
export interface KungalWorksListData {
  items: KungalWorkItem[]
  next_cursor: string | null
}

/** works/search 响应 data */
export interface KungalWorksSearchData extends KungalWorksListData {
  total: number
}

/** lookup 响应 data */
export interface KungalLookupData {
  work: KungalWorkItem | null
  claimed_by?: unknown
}

/** 信封 */
export interface KungalEnvelope<T> {
  code: number
  message: string
  data: T
}
