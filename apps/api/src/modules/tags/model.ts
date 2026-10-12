import { t } from 'elysia'

export namespace TagsModel {
  export const gameTags = t.Object({
    id: t.String({ minLength: 1 }),
  })
  export const tagId = t.Object({
    tagId: t.String({ minLength: 1 }),
  })
  export const tagGames = t.Object({
    tagId: t.String({ minLength: 1 }),
    pageSize: t.Number({ minimum: 1, default: 10 }),
    pageIndex: t.Number({ minimum: 0, default: 0 }),
    // 是否把子标签（任意深度后代）的作品一并计入。
    // 默认 false 保持既有行为，仅按该标签直接标注的作品过滤。
    includeChildren: t.Optional(t.Boolean({ default: false })),
  })
  export const tagAll = t.Object({
    pageSize: t.Number({ minLength: 1, default: 10 }),
    pageIndex: t.Number({ minimum: 0, default: 0 }),
    keyword: t.Union([t.String(), t.Undefined()]),
    id: t.Union([t.String(), t.Undefined()]),
  })
  export const tagEdit = t.Object({
    id: t.String({ minLength: 1 }),
    zh_name: t.String({ minLength: 1 }),
    exhibition: t.Boolean(),
    zh_alias: t.String(),
    zh_description: t.String(),
  })
  export const tagFileAdd = t.Object({
    file: t.File(),
  })
  /**
   * 标签库 hub（参考 dg.zi0.in/tags 的分组浏览）。
   * - group: 只取某一分类；缺省返回全部分类
   * - limit: 每类预览标签数（参考站固定 24，这里放开便于「展开更多」）
   * - sort: 预览排序依据；count 收录数（缺省，参考站口径）、views 累计
   *   浏览量、hotWeek / hotMonth 本周 / 本月浏览量（时间窗热度）、name 中文名称
   * - order: 排序方向；desc 降序（缺省，数值从大到小 / 名称 Z→A）、asc 升序。
   *   **排序在服务端切片之前完成**，否则「按查看次数排前 24」会退化成
   *   「收录数前 24 条里再按查看次数排」。
   */
  export const tagHub = t.Object({
    group: t.Optional(
      t.Union([
        t.Literal('character'),
        t.Literal('theme'),
        t.Literal('plot'),
        t.Literal('setting'),
        t.Literal('gameplay'),
        t.Literal('hot'),
      ]),
    ),
    limit: t.Optional(t.Number({ minimum: 1, maximum: 500, default: 24 })),
    sort: t.Optional(
      t.Union([
        t.Literal('count'),
        t.Literal('views'),
        t.Literal('hotWeek'),
        t.Literal('hotMonth'),
        t.Literal('name'),
      ]),
    ),
    order: t.Optional(t.Union([t.Literal('desc'), t.Literal('asc')])),
  })
  /**
   * 标签库分类页：取某一分类下的**全部**标签（不设上限）。
   * hub 的 limit 最多 500，而单个分类实测可超过 1000 个标签，
   * 所以「查看全部」必须走这个不分页、不截断的接口。
   * cont 是层级未同步时的降级分类，一并放开以便分类页可达。
   */
  export const tagGroup = t.Object({
    group: t.Union([
      t.Literal('character'),
      t.Literal('theme'),
      t.Literal('plot'),
      t.Literal('setting'),
      t.Literal('gameplay'),
      t.Literal('hot'),
      t.Literal('cont'),
    ]),
  })
  export type gameTags = typeof gameTags.static
  export type tagId = typeof tagId.static
  export type tagGames = typeof tagGames.static
  export type tagAll = typeof tagAll.static
  export type tagEdit = typeof tagEdit.static
  export type tagFileAdd = typeof tagFileAdd.static
  export type tagHub = typeof tagHub.static
  export type tagGroup = typeof tagGroup.static
}
