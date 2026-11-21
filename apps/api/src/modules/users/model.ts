import { t } from 'elysia'

/**
 * 后台用户列表查询条件。
 *
 * Better Auth 的 admin.listUsers 只能按用户表单列过滤，无法区分「邮箱账号 /
 * 第三方账号」（账号来源在 galrc_account 里），因此后台列表改由本模块直查库。
 */
export namespace UsersModel {
  export const adminList = t.Object({
    /** 关键词：按 searchField 指定的列做包含匹配 */
    searchValue: t.Optional(t.String({ maxLength: 200 })),
    /** email=邮箱（默认），name=用户名 */
    searchField: t.Optional(t.Union([t.Literal('email'), t.Literal('name')])),
    /** 不传=全部，active=正常，banned=已封禁 */
    status: t.Optional(t.Union([t.Literal('active'), t.Literal('banned')])),
    /** 不传=全部，email=邮箱注册，third-party=第三方登录（按最早创建的账号判断） */
    authMethod: t.Optional(
      t.Union([t.Literal('email'), t.Literal('third-party')]),
    ),
    limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 15 })),
    offset: t.Optional(t.Number({ minimum: 0, default: 0 })),
  })

  export type adminList = typeof adminList.static
}
