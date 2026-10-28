import { t } from 'elysia'

/**
 * 名称/图片/链接的共用约束：
 * - pattern '\\S' 拦住纯空白（minLength 只会数长度，'   ' 也算 3 个字符）；
 * - 长度上限与 DB 列宽对齐（name 是 varchar(255)），避免超长触发 PG 22001 变 500；
 * - image 放行站内相对路径（/dzmm.webp）与 http(s) 外链，href 只放行 http(s)：
 *   否则绕过后台表单直接调 API 能写进 javascript: / data: 之类的地址，点开就是 XSS。
 */
const Name = t.String({ minLength: 1, maxLength: 255, pattern: '\\S' })
const Image = t.String({
  minLength: 1,
  maxLength: 2048,
  pattern: '^(https?://|/)\\S+$',
})
const Href = t.String({
  minLength: 1,
  maxLength: 2048,
  pattern: '^https?://\\S+$',
})
/** description 只是后台备注，可清空（'' 由 service 归一化成 NULL）。 */
const OptionalText = t.Optional(t.String({ maxLength: 2048 }))

/**
 * 排期时间：只做长度/类型兜底，真正的 ISO 解析与先后校验在 service 里做。
 * update 允许显式 null（清空排期），所以是 Optional(Nullable(String))。
 */
const IsoDateTime = t.String({ maxLength: 40 })
const OptionalDateTime = t.Optional(t.Nullable(IsoDateTime))

/**
 * 广告位标识（模板调用 key）：与 DB 列 varchar(64) 对齐，小写字母开头，
 * 只含小写字母/数字/下划线。它同时是公开接口的路由参数，不做大小写归一，
 * 避免「库里存 abc、模板写 ABC」这种只在运行时才暴露的错配。
 */
const SlotKey = t.String({
  minLength: 2,
  maxLength: 64,
  pattern: '^[a-z][a-z0-9_]{1,63}$',
})

/** 手机端展示方式；数据库列是 varchar(16)，枚举值由这里把关。 */
const MobileMode = t.Union([
  t.Literal('carousel'),
  t.Literal('stack'),
  t.Literal('hidden'),
])

/** 素材设备定向；all = 桌面与手机都展示。 */
const Device = t.Union([
  t.Literal('all'),
  t.Literal('desktop'),
  t.Literal('mobile'),
])

/** 同屏最多几条素材：太多会把首屏挤掉，产品上限定 4。 */
const MaxItems = t.Integer({ minimum: 1, maximum: 4 })
/** 手机端自动轮播间隔（秒）：0 = 不自动切换；60 秒已是展示上限。 */
const CarouselInterval = t.Integer({ minimum: 0, maximum: 60 })
/**
 * 权重：只在候选多于展示位时参与加权抽取（0 权重优先级最低，正权重候选用尽后才兜底抽到）；
 * 候选不足 maxItems 时按 sort_order 全部展示，权重不参与。
 */
const Weight = t.Integer({ minimum: 0, maximum: 10000 })

export namespace AdvertModel {
  /** 路径参数是字符串，service/index 负责解析成整数。 */
  export const Params = t.Object({
    id: t.String(),
  })

  export const SlotParams = t.Object({
    key: t.String({ minLength: 1, maxLength: 64 }),
  })

  export const ListQuery = t.Object({
    /** slotId 是 URL query，运行时是字符串：handler 用 parseOptionalId 转整数。 */
    slotId: t.Optional(t.String()),
  })

  export const Track = t.Object({
    id: t.Integer({ minimum: 1 }),
    type: t.Union([t.Literal('impression'), t.Literal('click')]),
  })

  export const SlotCreate = t.Object({
    key: SlotKey,
    name: Name,
    description: OptionalText,
    maxItems: t.Optional(MaxItems),
    mobileMode: t.Optional(MobileMode),
    carouselInterval: t.Optional(CarouselInterval),
    enabled: t.Optional(t.Boolean()),
  })

  // 部分更新：省略 = 保持原值（service 只写显式传入的列）
  export const SlotUpdate = t.Object({
    key: t.Optional(SlotKey),
    name: t.Optional(Name),
    description: OptionalText,
    maxItems: t.Optional(MaxItems),
    mobileMode: t.Optional(MobileMode),
    carouselInterval: t.Optional(CarouselInterval),
    enabled: t.Optional(t.Boolean()),
  })

  export const Create = t.Object({
    slotId: t.Integer({ minimum: 1 }),
    name: Name,
    image: Image,
    href: Href,
    description: OptionalText,
    enabled: t.Optional(t.Boolean()),
    device: t.Optional(Device),
    weight: t.Optional(Weight),
    startAt: OptionalDateTime,
    endAt: OptionalDateTime,
  })

  // 排期字段允许显式 null（清空排期）；只传一侧时由 service 与现有另一侧比较先后。
  export const Update = t.Object({
    name: t.Optional(Name),
    image: t.Optional(Image),
    href: t.Optional(Href),
    description: OptionalText,
    enabled: t.Optional(t.Boolean()),
    device: t.Optional(Device),
    weight: t.Optional(Weight),
    startAt: OptionalDateTime,
    endAt: OptionalDateTime,
  })

  // 拖动排序：数组下标即新的 sortOrder（service 会校验 id 集合与去重）
  export const Reorder = t.Object({
    slotId: t.Integer({ minimum: 1 }),
    ids: t.Array(t.Integer({ minimum: 1 })),
  })

  export type params = typeof Params.static
  export type slotParams = typeof SlotParams.static
  export type listQuery = typeof ListQuery.static
  export type track = typeof Track.static
  export type slotCreate = typeof SlotCreate.static
  export type slotUpdate = typeof SlotUpdate.static
  export type create = typeof Create.static
  export type update = typeof Update.static
  export type reorder = typeof Reorder.static
}
