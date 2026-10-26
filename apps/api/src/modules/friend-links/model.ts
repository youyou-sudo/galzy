import { t } from 'elysia'

/**
 * 标题/链接的共用约束：
 * - pattern '\\S' 拦住纯空白（minLength 会把 '   ' 也算 1 个字符）；
 * - 长度上限与 DB 列宽对齐，避免超长触发 PG 22001 变成 500；
 * - href 只放行 http(s)，否则绕过后台表单直接调 API 能写进 javascript: 之类的地址。
 */
const Title = t.String({ minLength: 1, maxLength: 255, pattern: '\\S' })
const Href = t.String({
  minLength: 1,
  maxLength: 2048,
  pattern: '^https?://\\S+$',
})
const OptionalText = t.Optional(t.String({ maxLength: 2048 }))
/** sortOrder 写进 integer 列：负数会插队、小数会 500，都从源头挡掉。 */
const SortOrder = t.Integer({ minimum: 0 })

export namespace FriendLinkModel {
  export const Params = t.Object({
    id: t.String(),
  })

  export const Create = t.Object({
    title: Title,
    avatar: OptionalText,
    href: Href,
    description: OptionalText,
    sortOrder: t.Optional(SortOrder),
  })

  export const Update = t.Object({
    title: t.Optional(Title),
    avatar: OptionalText,
    href: t.Optional(Href),
    description: OptionalText,
    sortOrder: t.Optional(SortOrder),
  })

  // 拖动排序：数组下标即新的 sortOrder（service 会校验 id 集合与去重）
  export const Reorder = t.Object({
    ids: t.Array(t.Integer({ minimum: 1 })),
  })

  export type params = typeof Params.static
  export type create = typeof Create.static
  export type update = typeof Update.static
  export type reorder = typeof Reorder.static
}
