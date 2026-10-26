import { db, friendLinks } from '@api/libs'
import { asc, eq, sql } from 'drizzle-orm'
import { status } from 'elysia'
import type { FriendLinkModel } from './model'

/** service 返回给 HTTP 层的形状（createdAt 统一为 ISO 字符串）。 */
export type FriendLinkDTO = {
  id: number
  title: string
  avatar: string | null
  href: string
  description: string | null
  sortOrder: number
  createdAt: string | null
}

type FriendLinkRow = typeof friendLinks.$inferSelect

function toDTO(row: FriendLinkRow): FriendLinkDTO {
  return {
    id: row.id,
    title: row.title,
    avatar: row.avatar ?? null,
    href: row.href,
    description: row.description ?? null,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
  }
}

/**
 * 空字符串归一化为 NULL：后台表单清空可选字段后提交的是 ''，
 * 直接入库会让「有值」与「没值」两种语义混在一起（前端也难判断）。
 * undefined 表示「不修改」，仍返回 null 由调用方用 `?? null` 兜底。
 */
function emptyToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

export const FriendLinkService = {
  /** 公开列表：前台按 sort_order 展示，id 兜底保证顺序稳定。 */
  async list(): Promise<FriendLinkDTO[]> {
    const rows = await db
      .select()
      .from(friendLinks)
      .orderBy(asc(friendLinks.sortOrder), asc(friendLinks.id))
    return rows.map(toDTO)
  },

  /** 新增：sortOrder 省略时排到末尾（当前最大值 + 1，空表为 0）。 */
  async create(data: FriendLinkModel.create): Promise<FriendLinkDTO> {
    let sortOrder = data.sortOrder
    if (sortOrder === undefined) {
      const [row] = await db
        .select({ max: sql<number | null>`max(${friendLinks.sortOrder})` })
        .from(friendLinks)
      sortOrder =
        row?.max === null || row?.max === undefined ? 0 : Number(row.max) + 1
    }

    const [created] = await db
      .insert(friendLinks)
      .values({
        title: data.title,
        avatar: emptyToNull(data.avatar),
        href: data.href,
        description: emptyToNull(data.description),
        sortOrder,
      })
      .returning()
    return toDTO(created)
  },

  /** 更新：body 字段全部可选，只写显式传入的列（undefined = 保持不变）。 */
  async update(
    id: number,
    data: FriendLinkModel.update,
  ): Promise<FriendLinkDTO> {
    const [existing] = await db
      .select({ id: friendLinks.id })
      .from(friendLinks)
      .where(eq(friendLinks.id, id))
      .limit(1)
    if (!existing) throw status(404, '友情链接不存在喵～')

    const [updated] = await db
      .update(friendLinks)
      .set({
        ...(data.title !== undefined && { title: data.title }),
        ...(data.avatar !== undefined && { avatar: emptyToNull(data.avatar) }),
        ...(data.href !== undefined && { href: data.href }),
        ...(data.description !== undefined && {
          description: emptyToNull(data.description),
        }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      })
      .where(eq(friendLinks.id, id))
      .returning()
    return toDTO(updated)
  },

  async delete(id: number): Promise<{ success: true }> {
    const [existing] = await db
      .select({ id: friendLinks.id })
      .from(friendLinks)
      .where(eq(friendLinks.id, id))
      .limit(1)
    if (!existing) throw status(404, '友情链接不存在喵～')

    await db.delete(friendLinks).where(eq(friendLinks.id, id))
    return { success: true }
  },

  /** 拖动排序：数组下标即新的 sortOrder；不存在的 id 更新 0 行，自动忽略。 */
  async reorder(ids: number[]): Promise<{ success: true }> {
    await db.transaction(async (trx) => {
      for (const [index, id] of ids.entries()) {
        await trx
          .update(friendLinks)
          .set({ sortOrder: index })
          .where(eq(friendLinks.id, id))
      }
    })
    return { success: true }
  },
}
