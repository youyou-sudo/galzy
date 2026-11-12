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

/* ─────────────────────── walkthrough（攻略）wire 类型 ─────────────────────── */
// 下面这些形状与 spec 一一对应，**内层字段一律 snake_case**：chart 是原样透传
// 给前端的（见 db/schema/kungal.ts 的 galrc_kungal_walkthroughs 注释），所以
// wire 类型即 DTO 内层类型，中间不做一次改名。只有最外层的标量会映射成
// camelCase（normalize.normalizeWalkthrough 负责）。
// 每个对象上游都标了 additionalProperties=true，这里只列当前已知键，读侧遇到
// 未知键不会报错（jsonb 原样透传）。

/** localized 映射：BCP-47 语言 → 该语言的文本块。 */
export type KungalLocalizedMap = Record<string, KungalLocalizedText>

/** chart 节点：entry / save / ending 是具名节点，collect / open 是终点占位。 */
export interface KungalWalkthroughNode {
  key: string | null
  node_type: 'entry' | 'save' | 'ending' | 'collect' | 'open'
}

/**
 * 步骤的替代选项（收集 CG 差异用）。
 * 主路径走 WalkthroughStep.text，其余同屏选项在 alternatives。
 */
export interface KungalWalkthroughAlternative {
  text: string
  localized: KungalLocalizedMap
}

/**
 * 一个步骤。step_type 是闭合词表：
 * choice 选菜单、action 其它操作、save 建存档、heading 分节标题、note 说明。
 * text 为 null 只出现在 save 步骤；上游若加新的 step_type，前端应只渲染不编号。
 */
export interface KungalWalkthroughStep {
  step_type: 'choice' | 'action' | 'save' | 'heading' | 'note'
  text: string | null
  localized: KungalLocalizedMap
  alternatives: KungalWalkthroughAlternative[]
  remark: string | null
  remark_localized: KungalLocalizedMap
  achievement: boolean
  save_key: string | null
}

/** chart 的边：从一个节点走到另一个节点的一串步骤。 */
export interface KungalWalkthroughSegment {
  key: string
  section_key: string | null
  from_node: KungalWalkthroughNode
  condition: string | null
  condition_localized: KungalLocalizedMap
  /** endings[].key 的前置结局（导入时只填能解析出来的） */
  requires_ending_keys: string[]
  steps: KungalWalkthroughStep[]
  to_node: KungalWalkthroughNode
}

/** 原页面的分组标题（通常一条路线一个），segments[].section_key 指过来。 */
export interface KungalWalkthroughSection {
  key: string
  title: string
  localized: KungalLocalizedMap
  /** characters[].key */
  character_keys: string[]
}

/** 起点（标题画面，或某个结局解锁后的续玩入口）。 */
export interface KungalWalkthroughEntry {
  key: string
  label: string
  localized: KungalLocalizedMap
  unlocked_by_ending_key: string | null
}

/** 结局。同名重复出现算多个结局，故 key 才是身份。 */
export interface KungalWalkthroughEnding {
  key: string
  name: string
  localized: KungalLocalizedMap
  ending_type:
    | 'heroine'
    | 'harem'
    | 'true'
    | 'normal'
    | 'bad'
    | 'after'
    | 'other'
  character_keys: string[]
}

/** 存档点（save 步骤建立、这里声明它的标签）。 */
export interface KungalWalkthroughSave {
  key: string
  label: string
  localized: KungalLocalizedMap
}

/** 原页面对自己记号（★ / ⇒ …）的定义，用来解释步骤上的标记。 */
export interface KungalWalkthroughLegendLine {
  text: string
  localized: KungalLocalizedMap
}

/**
 * chart 本体：节点表 + 边表 + 图例。
 * 六个数组上游承诺「空数组、绝非 null」，故都按非空数组建模。
 */
export interface KungalWalkthroughChart {
  sections: KungalWalkthroughSection[]
  legend: KungalWalkthroughLegendLine[]
  entries: KungalWalkthroughEntry[]
  saves: KungalWalkthroughSave[]
  endings: KungalWalkthroughEnding[]
  segments: KungalWalkthroughSegment[]
}

/** 攻略对应的发行版（官方/汉化补丁）。 */
export interface KungalWalkthroughRelease {
  id: string
  title: string | null
  release_kind: 'default' | 'digital' | 'physical' | 'trial' | 'patch'
  lang: string | null
  companies: string[]
}

/** chart 里的角色 key 表（section/ending 用 key 引用它）。 */
export interface KungalWalkthroughCharacter {
  key: string
  name: string
  character_id: string | null
  display_name: string | null
  localized: KungalLocalizedMap
}

/**
 * catalog walkthrough 行。
 *
 * 注意 chart **只出现在详情接口**（GET /catalog/walkthroughs/{id}）；
 * 列表（?work_id=）不带 chart，其余字段都在 —— 同步侧正是靠这一点先拉列表
 * 判断 updated_at 有没有变、只为变了的行再拉详情。
 */
export interface KungalWalkthrough {
  object?: 'walkthrough'
  id: string
  work_id: string
  lang: string
  source: string
  source_url: string | null
  source_author: string | null
  source_updated_on: string | null
  work_content_limit: 'sfw' | 'nsfw'
  work_route_hints: boolean
  release: KungalWalkthroughRelease | null
  characters: KungalWalkthroughCharacter[]
  chart?: KungalWalkthroughChart | null
  ending_count: number
  save_count: number
  segment_count: number
  updated_at: string
}

/** 攻略列表响应（v2 统一 list 形状）。 */
export interface KungalWalkthroughListData {
  items: KungalWalkthrough[]
  missing?: string[]
  next_cursor?: string | null
}

/**
 * 全局攻略目录的裁剪行（fields= id,work_id,updated_at）。
 *
 * 不带 work_id 的 GET /catalog/walkthroughs 就是全站攻略集合，同步侧先用它
 * 做「发现 + 变更比对」；真正要落库的行再走 ids= 批量车道拿完整的列表行。
 */
export interface KungalWalkthroughIndexRow {
  object?: 'walkthrough'
  id: string
  work_id: string
  updated_at?: string | null
}

/** 裁剪后的攻略列表响应（目录翻页与 ids= 批量车道共用 v2 的 list 形状）。 */
export interface KungalWalkthroughIndexListData {
  items: KungalWalkthroughIndexRow[]
  missing?: string[]
  next_cursor?: string | null
  total?: number
}
