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

/** 必填文本：先 trim 再判空，避免 '   ' 通过校验后落库成空白卡片。 */
function requiredText(value: string, label: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw status(400, `${label}不能为空喵～`)
  return trimmed
}

/**
 * 排序号的串行化闸门。
 *
 * 「读 max(sort_order) → 插入」与「整表重排」都必须互斥，否则并发新增会拿到
 * 同一个 sortOrder，两个后台同时拖动会互相覆盖。advisory lock 是事务级的，
 * 提交/回滚自动释放，不需要额外清理。
 */
const SORT_LOCK_KEY = 'galzy:friend-links:sort-order'

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
    const title = requiredText(data.title, '标题')
    const href = requiredText(data.href, '链接')

    return db.transaction(async (trx) => {
      await trx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${SORT_LOCK_KEY}))`,
      )

      let sortOrder = data.sortOrder
      if (sortOrder === undefined) {
        const [row] = await trx
          .select({ max: sql<number | null>`max(${friendLinks.sortOrder})` })
          .from(friendLinks)
        sortOrder =
          row?.max === null || row?.max === undefined ? 0 : Number(row.max) + 1
      }

      const [created] = await trx
        .insert(friendLinks)
        .values({
          title,
          avatar: emptyToNull(data.avatar),
          href,
          description: emptyToNull(data.description),
          sortOrder,
        })
        .returning()
      return toDTO(created)
    })
  },

  /** 更新：body 字段全部可选，只写显式传入的列（undefined = 保持不变）。 */
  async update(
    id: number,
    data: FriendLinkModel.update,
  ): Promise<FriendLinkDTO> {
    const patch = {
      ...(data.title !== undefined && {
        title: requiredText(data.title, '标题'),
      }),
      ...(data.href !== undefined && { href: requiredText(data.href, '链接') }),
      ...(data.avatar !== undefined && { avatar: emptyToNull(data.avatar) }),
      ...(data.description !== undefined && {
        description: emptyToNull(data.description),
      }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
    }

    // 空 patch 会让 drizzle 抛 "No values to set"（500），提前转成 400
    if (Object.keys(patch).length === 0) {
      throw status(400, '没有需要更新的字段喵～')
    }

    // 直接用 returning() 判存在性：省一次 select，也没有「先查后改」的 TOCTOU
    const [updated] = await db
      .update(friendLinks)
      .set(patch)
      .where(eq(friendLinks.id, id))
      .returning()
    if (!updated) throw status(404, '友情链接不存在喵～')
    return toDTO(updated)
  },

  async delete(id: number): Promise<{ success: true }> {
    const deleted = await db
      .delete(friendLinks)
      .where(eq(friendLinks.id, id))
      .returning({ id: friendLinks.id })
    if (deleted.length === 0) throw status(404, '友情链接不存在喵～')
    return { success: true }
  },

  /**
   * 拖动排序：数组下标即新的 sortOrder。
   *
   * - 先校验「提交的 id 集合 == 表里现有 id 集合」：少传会让未提交的行保留旧序号、
   *   与新序号 0..n-1 重叠，前台顺序错乱；
   * - 更新按 id 升序执行，两个后台同时拖动时加锁顺序一致，不会死锁。
   */
  async reorder(ids: number[]): Promise<{ success: true }> {
    const unique = new Set(ids)
    if (unique.size !== ids.length) {
      throw status(400, '排序列表里有重复 id 喵～')
    }

    return db.transaction(async (trx) => {
      await trx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${SORT_LOCK_KEY}))`,
      )

      const rows = await trx.select({ id: friendLinks.id }).from(friendLinks)
      const existing = new Set(rows.map((row) => row.id))
      const matches =
        existing.size === unique.size &&
        [...unique].every((id) => existing.has(id))
      if (!matches) {
        throw status(400, '排序列表与现有友链不匹配，请刷新后重试喵～')
      }

      const ordered = ids
        .map((id, index) => ({ id, index }))
        .sort((a, b) => a.id - b.id)
      for (const { id, index } of ordered) {
        await trx
          .update(friendLinks)
          .set({ sortOrder: index })
          .where(eq(friendLinks.id, id))
      }

      return { success: true }
    })
  },
}
