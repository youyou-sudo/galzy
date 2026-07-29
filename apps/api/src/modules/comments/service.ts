import { comments, db, sql, users } from '@api/libs'
import { emailServer } from '@api/libs/seedMail'
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  inArray,
  isNull,
} from 'drizzle-orm'
import { status } from 'elysia'
import type { CommentModel } from './model'

export const CommentService = {
  // 查询评论
  async getComments({
    targetType,
    targetId,
    page = 1,
    limit = 20,
    type,
    status = 'normal',
  }: CommentModel.list) {
    const conditions: any[] = [
      eq(comments.status, status),
      isNull(comments.parentId),
      isNull(comments.replyToUserId),
    ]

    if (targetType) {
      conditions.push(eq(comments.targetType, targetType))
    }
    if (targetId) {
      conditions.push(eq(comments.targetId, targetId))
    }
    if (type) {
      conditions.push(eq(comments.type, type))
    }

    const whereClause = and(...conditions)

    const [commentsData, countResult] = await Promise.all([
      db
        .select({
          ...getTableColumns(comments),
          user: sql<{
            id: string
            name: string
            email: string
            image: string
          } | null>`
            CASE WHEN ${users.id} IS NOT NULL
              THEN json_build_object('id', ${users.id}, 'name', ${users.name}, 'email', ${users.email}, 'image', ${users.image})
              ELSE NULL
            END
          `.as('user'),
        })
        .from(comments)
        .leftJoin(users, eq(comments.userId, users.id))
        .where(whereClause)
        .orderBy(desc(comments.isPinned), desc(comments.createdAt))
        .offset((page - 1) * limit)
        .limit(limit),
      db
        .select({ total: count() })
        .from(comments)
        .where(whereClause)
        .then((r) => r[0]),
    ])

    // Batch-fetch all replies for this page of comments (2nd query, not N)
    const repliesByRoot = new Map<string, any[]>()
    if (commentsData.length > 0) {
      const rootIds = commentsData.map((c) => c.id)
      const replies = await db
        .select({
          ...getTableColumns(comments),
          user: sql<{
            id: string
            name: string
            email: string
            image: string
          } | null>`
            CASE WHEN ${users.id} IS NOT NULL
              THEN json_build_object('id', ${users.id}, 'name', ${users.name}, 'email', ${users.email}, 'image', ${users.image})
              ELSE NULL
            END
          `.as('user'),
          reUser: sql<{
            id: string
            name: string
            email: string
            image: string
          } | null>`
            CASE WHEN ${comments.replyToUserId} IS NOT NULL
              THEN (SELECT row_to_json("ru".*) FROM (SELECT "id", "name", "email", "image" FROM "galrc_user" WHERE "id" = ${comments.replyToUserId}) "ru")
              ELSE NULL
            END
          `.as('reUser'),
        })
        .from(comments)
        .leftJoin(users, eq(comments.userId, users.id))
        .where(and(gt(comments.depth, 0), inArray(comments.rootId, rootIds)))
        .orderBy(asc(comments.createdAt))
      for (const reply of replies) {
        const rootId = reply.rootId!
        if (!repliesByRoot.has(rootId)) repliesByRoot.set(rootId, [])
        repliesByRoot.get(rootId)!.push(reply)
      }
    }

    const enriched = commentsData.map((c) => ({
      ...c,
      re: repliesByRoot.get(c.id) ?? [],
    }))

    const total = Number(countResult?.total ?? 0)

    return {
      comments: enriched,
      total,
      totalPages: Math.ceil(total / limit),
    }
  },

  // 管理后台 - 获取所有评论（含回复，扁平化）
  async getCommentsForAdmin({
    targetType,
    targetId,
    page = 1,
    limit = 20,
    type,
    status: statusFilter,
    excludeReplies,
  }: CommentModel.list) {
    const conditions: any[] = []

    if (excludeReplies) {
      conditions.push(eq(comments.depth, 0))
    }
    if (statusFilter) {
      conditions.push(eq(comments.status, statusFilter))
    }
    if (targetType) {
      conditions.push(eq(comments.targetType, targetType))
    }
    if (targetId) {
      conditions.push(eq(comments.targetId, targetId))
    }
    if (type) {
      conditions.push(eq(comments.type, type))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [commentsData, countResult] = await Promise.all([
      db
        .select({
          ...getTableColumns(comments),
          user: sql<{
            id: string
            name: string
            email: string
            image: string
          } | null>`
            CASE WHEN ${users.id} IS NOT NULL
              THEN json_build_object('id', ${users.id}, 'name', ${users.name}, 'email', ${users.email}, 'image', ${users.image})
              ELSE NULL
            END
          `.as('user'),
        })
        .from(comments)
        .leftJoin(users, eq(comments.userId, users.id))
        .where(whereClause)
        .orderBy(desc(comments.createdAt))
        .offset((page - 1) * limit)
        .limit(limit),
      db
        .select({ total: count() })
        .from(comments)
        .where(whereClause)
        .then((r) => r[0]),
    ])

    const total = Number(countResult?.total ?? 0)

    return {
      comments: commentsData,
      total,
      totalPages: Math.ceil(total / limit),
    }
  },

  async createComment(
    {
      targetType,
      targetId,
      content,
      parentId,
      replyToUserId,
      type = 'comment',
    }: CommentModel.create,
    userId: string,
  ) {
    const now = new Date()
    let depth = 0
    let rootId: string | null = null

    let parent:
      | {
          id: string
          rootId: string | null
          depth: number
          targetType: string
          targetId: string
          userId: string
        }
      | undefined

    if (parentId) {
      parent = await db
        .select({
          id: comments.id,
          rootId: comments.rootId,
          depth: comments.depth,
          targetType: comments.targetType,
          targetId: comments.targetId,
          userId: comments.userId,
        })
        .from(comments)
        .where(and(eq(comments.id, parentId), eq(comments.status, 'normal')))
        .then((r) => r[0])

      if (!parent) {
        throw status(404, '父评论不存在或已被删除')
      }

      depth = parent.depth + 1
      rootId = parent.rootId
    }

    const [inserted] = await db.transaction(async (trx) => {
      const [result] = await trx
        .insert(comments)
        .values({
          targetType,
          targetId,
          userId,
          content,
          type,
          parentId: parentId ?? null,
          rootId: rootId,
          depth,
          replyToUserId: replyToUserId ?? null,
          status: 'normal',
          feedbackStatus: null,
          isPinned: false,
          isWhispers: false,
          lastReplyAt: now,
          meta: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        } as any)
        .returning()

      // For top-level comments, set rootId to the generated id
      if (!parentId) {
        const idStr = String(result.id)
        await trx
          .update(comments)
          .set({ rootId: idStr })
          .where(eq(comments.id, result.id))
      }

      // Update parent's lastReplyAt
      if (parentId) {
        await trx
          .update(comments)
          .set({ lastReplyAt: now })
          .where(eq(comments.id, parentId))
      }

      return [result]
    })

    // Fire-and-forget email notification to parent comment author
    if (parentId && parent && parent.userId !== userId) {
      ;(async () => {
        try {
          const parentUser = await db
            .select({ email: users.email, name: users.name })
            .from(users)
            .where(eq(users.id, parent.userId))
            .then((r) => r[0])

          if (!parentUser?.email) return

          const commentUrl = `${process.env.WEB_HOST}/${parent.targetType}/${parent.targetId}`
          const preview =
            content.length > 100 ? content.slice(0, 100) + '…' : content

          await emailServer.send({
            from: '紫缘社 <noreply@outbound.galzy.moe>',
            to: parentUser.email,
            subject: '你的评论收到了回复喵～',
            text: `你好 ${parentUser.name}，你的评论收到了新的回复喵～\n\n回复内容：${preview}\n\n查看完整对话：${commentUrl}`,
          })
        } catch (err) {
          console.error('发送回复通知邮件失败:', err)
        }
      })()
    }

    // Return the created comment with user info — fetch user via LEFT JOIN
    const [comment] = await db
      .select({
        user: sql<{ id: string; name: string; image: string } | null>`
          CASE WHEN ${users.id} IS NOT NULL
            THEN json_build_object('id', ${users.id}, 'name', ${users.name}, 'image', ${users.image})
            ELSE NULL
          END
        `.as('user'),
      })
      .from(users)
      .where(eq(users.id, userId))

    return { ...inserted, user: comment?.user ?? null }
  },

  async updateComment(
    { id }: CommentModel.params,
    { content }: CommentModel.update,
    userId: string,
    role?: string | null,
  ) {
    role = role ?? 'user'

    // Build ownership check — admin bypasses userId check
    const whereConditions: any[] = [
      eq(comments.id, id),
      eq(comments.status, 'normal'),
    ]
    if (role !== 'admin') {
      whereConditions.push(eq(comments.userId, userId))
    }

    const [updated] = await db
      .update(comments)
      .set({ content, updatedAt: new Date() })
      .where(and(...whereConditions))
      .returning({ id: comments.id })

    if (!updated) {
      throw new Error('评论不存在、已被删除或无权编辑')
    }

    return { success: true }
  },

  async deleteComment(
    { id }: CommentModel.params,
    userId: string,
    isAdmin: boolean,
  ) {
    const whereConditions: any[] = [
      eq(comments.id, id),
      eq(comments.status, 'normal'),
    ]
    if (!isAdmin) {
      whereConditions.push(eq(comments.userId, userId))
    }

    const [updated] = await db
      .update(comments)
      .set({
        status: 'deleted',
        deletedAt: new Date(),
      })
      .where(and(...whereConditions))
      .returning({ id: comments.id })

    if (!updated) {
      throw new Error('评论不存在、已被删除或无权删除')
    }

    return { success: true }
  },

  async togglePin({ id }: CommentModel.params) {
    const [updated] = await db
      .update(comments)
      .set({ isPinned: sql`NOT ${comments.isPinned}` })
      .where(and(eq(comments.id, id), eq(comments.status, 'normal')))
      .returning({ isPinned: comments.isPinned })

    if (!updated) {
      throw status(404, '评论不存在或已被删除')
    }

    return { isPinned: updated.isPinned }
  },

  async changeCommentStatus(
    { id }: CommentModel.params,
    { status }: CommentModel.changeStatus,
  ) {
    await db
      .update(comments)
      .set({
        status,
        ...(status === 'deleted' ? { deletedAt: new Date() } : {}),
      })
      .where(eq(comments.id, id))

    return { success: true }
  },
}
