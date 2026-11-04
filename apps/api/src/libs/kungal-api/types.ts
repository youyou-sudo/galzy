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

/** catalog redirects feed 行：id 收敛（merge）事件 */
export interface KungalRedirect {
  old_id: string
  current_id: string
  target_object?: string
  merged_at?: string
}

/** 目录 redirects 列表响应（v2 统一 list 形状） */
export interface KungalRedirectListData {
  items: KungalRedirect[]
  next_cursor?: string | null
}

/** catalog 图片块（角色 image/figure 与作品封面同形状）。url 恒为绝对地址。 */
export interface KungalImage {
  hash?: string
  url?: string
  width?: number | null
  height?: number | null
  thumbhash?: string | null
  sexual?: 'safe' | 'suggestive' | 'explicit' | null
  violence?: 'tame' | 'violent' | 'brutal' | null
  source?: string
}

/** localized 块的一格（角色与作品共用） */
export interface KungalLocalizedText {
  value?: string
  is_machine?: boolean
  /** 历史 works 行的字段名（v1 时代叫 machine），角色行只有 is_machine */
  machine?: boolean
  kind?: string
}

/**
 * works/{id}/characters 名册行（WorkCharacter）。
 *
 * 注意：名册只有 nsfw/cursor/limit，没有 view/include —— 行内**没有**
 * gender/birthday/身高体重/三围/简介/traits，这些必须走 ids= 批量水合
 * （/catalog/characters?ids=…&view=full&include=…）。
 */
export interface KungalWorkCharacter {
  object?: 'character'
  id: string
  display_name: string
  latin?: string | null
  localized?: Record<string, KungalLocalizedText> | null
  roster_role?: string | null
  spoiler?: string | null
  voices?: unknown[] | null
  image?: KungalImage | null
  figure?: KungalImage | null
  identity?: string | null
}

/** /catalog/characters 行（Character；view=full + include 之后） */
export interface KungalCharacterItem {
  object?: 'character'
  id: string
  display_name: string
  latin?: string | null
  lang?: string | null
  localized?: Record<string, KungalLocalizedText> | null
  gender?: string | null
  /** MM-DD（无年份，不是日期） */
  birthday?: string | null
  blood_type?: string | null
  height_cm?: number | null
  weight_kg?: number | null
  instance_of_id?: string | null
  measurements?: {
    bust_cm?: number | null
    waist_cm?: number | null
    hip_cm?: number | null
    cup?: string | null
  } | null
  image?: KungalImage | null
  figure?: KungalImage | null
  intros?: Array<{
    lang?: string
    value?: string
    is_machine?: boolean
    source?: string
  }> | null
  traits?: unknown[] | null
  refs?: Array<{ source?: string; external_id?: string }> | null
  work_count?: number | null
}

/** /catalog/characters/{id}/appearances 行（Appearance） */
export interface KungalCharacterAppearance {
  object?: 'appearance'
  work?: KungalWorkItem | null
  roster_role?: string | null
  spoiler?: string | null
  voices?: unknown[] | null
}

/** 角色列表响应（v2 统一 list 形状） */
export interface KungalCharacterListData {
  items: KungalWorkCharacter[]
  missing?: string[]
  next_cursor?: string | null
}

/** 角色详情列表响应（view=full 的 Character 行） */
export interface KungalCharacterDetailListData {
  items: KungalCharacterItem[]
  missing?: string[]
  next_cursor?: string | null
}

/** 出场作品列表响应（Appearance 行） */
export interface KungalCharacterAppearanceListData {
  items: KungalCharacterAppearance[]
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
