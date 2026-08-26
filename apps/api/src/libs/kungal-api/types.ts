// NextMoe·未萌 开放 API v2（Kungalapi / 鲲 Galgame 数据）wire 类型
// 无信封：资源直接是 body；错误为 RFC 9457 application/problem+json。

/** catalog works 行（include=titles,intros,covers,ratings,refs 之后的部分字段） */
export interface KungalWorkItem {
  id: string
  display_name: string | null
  localized?: Record<
    string,
    { value?: string; kind?: string; machine?: boolean }
  > | null
  intros?: Array<{ lang?: string; value?: string; intro?: string }> | null
  cover?: {
    url?: string
    width?: number | null
    height?: number | null
    thumbhash?: string | null
    source?: string
  } | null
  banner?: {
    url?: string
    width?: number | null
    height?: number | null
    thumbhash?: string | null
    source?: string
  } | null
  covers?: Array<{
    id?: string
    url?: string
    width?: number | null
    height?: number | null
    thumbhash?: string | null
    portrait_pinned?: boolean
    vote_count?: number
    source?: string
  }> | null
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
}

/** 目录 works 列表响应（v2 统一 list 形状） */
export interface KungalWorksListData {
  items: KungalWorkItem[]
  missing?: string[]
  next_cursor?: string | null
}

/** RFC 9457 错误体 */
export interface KungalProblem {
  type?: string
  title?: string
  status?: number
  code?: string
  detail?: string
}
