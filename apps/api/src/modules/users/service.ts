import { accounts, db, users } from '@api/libs'
import { and, count, desc, eq, ilike, sql } from 'drizzle-orm'
import type { UsersModel } from './model'

/** Better Auth 用 credential 表示「邮箱 + 密码」账号，其余 providerId 都是第三方 OAuth。 */
const EMAIL_PROVIDER_ID = 'credential'

export const UserService = {
  /**
   * 后台用户列表。
   *
   * 搜索 / 封禁状态 / 注册方式都在库里过滤。注册方式不在 galrc_user 上，而是
   * 看 galrc_account：Better Auth 在注册（或首次 OAuth 登录）时才创建账号，
   * 取按 createdAt 最早的那条账号，它的 providerId 就是用户的入口方式；之后
   * 再绑定第三方账号不会改变这个判断。
   */
  async adminList(query: UsersModel.adminList) {
    const limit = Math.min(Math.max(Number(query.limit ?? 15), 1), 100)
    const offset = Math.max(Number(query.offset ?? 0), 0)

    const conditions: ReturnType<typeof eq>[] = []

    const keyword = query.searchValue?.trim()
    if (keyword) {
      const pattern = `%${keyword}%`
      conditions.push(
        query.searchField === 'name'
          ? ilike(users.name, pattern)
          : ilike(users.email, pattern),
      )
    }

    if (query.status === 'banned') conditions.push(eq(users.banned, true))
    if (query.status === 'active') conditions.push(eq(users.banned, false))

    if (query.authMethod) {
      const firstProvider = sql`(SELECT ${accounts.providerId} FROM ${accounts} WHERE ${accounts.userId} = ${users.id} ORDER BY ${accounts.createdAt} ASC LIMIT 1)`
      conditions.push(
        query.authMethod === 'email'
          ? sql`${firstProvider} = ${EMAIL_PROVIDER_ID}`
          : sql`${firstProvider} <> ${EMAIL_PROVIDER_ID}`,
      )
    }

    const where = conditions.length ? and(...conditions) : undefined

    const [rows, totalRow] = await Promise.all([
      db
        .select()
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(users)
        .where(where)
        .then((r) => r[0]),
    ])

    return {
      users: rows,
      total: Number(totalRow?.total ?? 0),
      limit,
      offset,
    }
  },
}
