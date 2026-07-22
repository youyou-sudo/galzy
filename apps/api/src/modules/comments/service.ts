import { comments, db, sql, users } from '@api/libs'
import { emailServer } from '@api/libs/seedMail'
import { and, count, desc, eq, getTableColumns, isNull } from 'drizzle-orm'
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
          user: sql<{ id: string; name: string; email: string; image: string }>`
            (SELECT row_to_json("u".*) FROM (SELECT "id", "name", "email", "image" FROM "galrc_user" WHERE "id" = ${comments.userId}) "u")
          `.as('user'),
          re: sql<Array<Record<string, any>>>`
            COALESCE(
              (SELECT json_agg(row_to_json("c".*)) FROM (
                SELECT
                  "c".*,
                  (SELECT row_to_json("u".*) FROM (SELECT "id", "name", "email", "image" FROM "galrc_user" WHERE "id" = "c"."userId") "u") AS "user",
                  (SELECT row_to_json("ru".*) FROM (SELECT "id", "name", "email", "image" FROM "galrc_user" WHERE "id" = "c"."replyToUserId") "ru") AS "reUser"
                FROM "galrc_comments" "c"
                WHERE "c"."depth" > 0 AND "c"."rootId" = ${comments.id}
              ) "c"),
              '[]'::json
            )
          `.as('re'),
        })
        .from(comments)
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

    const total = Number(countResult?.total ?? 0)

    return {
      comments: commentsData,
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
          user: sql<{ id: string; name: string; email: string; image: string }>`
            (SELECT row_to_json("u".*) FROM (SELECT "id", "name", "email", "image" FROM "galrc_user" WHERE "id" = ${comments.userId}) "u")
          `.as('user'),
        })
        .from(comments)
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

    const [inserted] = await db
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
      .returning({ id: comments.id })

    // For top-level comments, set rootId to the generated id
    if (!parentId) {
      const idStr = String(inserted.id)
      await db
        .update(comments)
        .set({ rootId: idStr })
        .where(eq(comments.id, inserted.id))
    }

    // Update parent's lastReplyAt
    if (parentId) {
      await db
        .update(comments)
        .set({ lastReplyAt: now })
        .where(eq(comments.id, parentId))
    }

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

    // Return the created comment with user info
    const [comment] = await db
      .select({
        ...getTableColumns(comments),
        user: sql<{ id: string; name: string; image: string }>`
          (SELECT row_to_json("u".*) FROM (SELECT "id", "name", "image" FROM "galrc_user" WHERE "id" = ${comments.userId}) "u")
        `.as('user'),
      })
      .from(comments)
      .where(eq(comments.id, inserted.id))

    return comment!
  },

  async updateComment(
    { id }: CommentModel.params,
    { content }: CommentModel.update,
    userId: string,
    role?: string | null,
  ) {
    role = role ?? 'user'

    const [comment] = await db
      .select()
      .from(comments)
      .where(and(eq(comments.id, id), eq(comments.status, 'normal')))

    if (!comment) {
      throw new Error('评论不存在或已被删除')
    }

    if (comment.userId !== userId || role !== 'admin') {
      throw new Error('无权编辑该评论')
    }

    await db.update(comments).set({ content }).where(eq(comments.id, id))

    return { success: true }
  },

  async deleteComment(
    { id }: CommentModel.params,
    userId: string,
    isAdmin: boolean,
  ) {
    const [comment] = await db
      .select()
      .from(comments)
      .where(and(eq(comments.id, id), eq(comments.status, 'normal')))

    if (!comment) {
      throw new Error('评论不存在或已被删除')
    }

    if (comment.userId !== userId && !isAdmin) {
      throw new Error('无权删除该评论')
    }

    await db
      .update(comments)
      .set({
        status: 'deleted',
        deletedAt: new Date(),
      })
      .where(eq(comments.id, id))

    return { success: true }
  },

  async togglePin({ id }: CommentModel.params) {
    const [comment] = await db
      .select()
      .from(comments)
      .where(and(eq(comments.id, id), eq(comments.status, 'normal')))

    if (!comment) {
      throw status(404, '评论不存在或已被删除')
    }

    await db
      .update(comments)
      .set({ isPinned: !comment.isPinned })
      .where(eq(comments.id, id))

    return { isPinned: !comment.isPinned }
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
