import { db } from '@api/libs'
import type { CommentStatus, CommentType } from '@api/libs/kysely/webData'
import { status } from 'elysia'
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres'
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
    let query = db
      .selectFrom('galrc_comments')
      .selectAll('galrc_comments')
      .where('status', '=', status as CommentStatus)
      .where('parentId', 'is', null)
      .where('replyToUserId', 'is', null)
      .select((eb) => [
        jsonObjectFrom(
          eb
            .selectFrom('galrc_user')
            .whereRef('galrc_user.id', '=', 'galrc_comments.userId')
            .select([
              'galrc_user.id',
              'galrc_user.name',
              'galrc_user.email',
              'galrc_user.image',
            ]),
        ).as('user'),

        jsonArrayFrom(
          eb
            .selectFrom('galrc_comments as c')
            .where('c.depth', '>', 0)
            .whereRef('c.rootId', '=', 'galrc_comments.id')
            .selectAll('c')
            .select((eb) => [
              jsonObjectFrom(
                eb
                  .selectFrom('galrc_user')
                  .whereRef('galrc_user.id', '=', 'c.userId')
                  .select([
                    'galrc_user.id',
                    'galrc_user.name',
                    'galrc_user.email',
                    'galrc_user.image',
                  ]),
              ).as('user'),
              jsonObjectFrom(
                eb
                  .selectFrom('galrc_user as reUser')
                  .whereRef('reUser.id', '=', 'c.replyToUserId')
                  .select([
                    'reUser.id',
                    'reUser.name',
                    'reUser.email',
                    'reUser.image',
                  ]),
              ).as('reUser'),
            ]),
        ).as('re'),
      ])

    if (targetType) {
      query = query.where(
        'targetType',
        '=',
        targetType as 'post' | 'article' | 'game',
      )
    }
    if (targetId) {
      query = query.where('targetId', '=', targetId)
    }
    if (type) {
      query = query.where('type', '=', type as CommentType)
    }

    const [comments, countResult] = await Promise.all([
      query
        .orderBy('isPinned', 'desc')
        .orderBy('createdAt', 'desc')
        .offset((page - 1) * limit)
        .limit(limit)
        .execute(),
      query
        .clearSelect()
        .clearOrderBy()
        .select(db.fn.countAll<number>().as('total'))
        .executeTakeFirst(),
    ])

    const total = countResult?.total ?? 0

    return {
      comments,
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
    let rootId = null

    if (parentId) {
      const parent = await db
        .selectFrom('galrc_comments')
        .select(['id', 'rootId', 'depth', 'targetType', 'targetId'])
        .where('id', '=', parentId)
        .where('status', '=', 'normal')
        .executeTakeFirst()

      if (!parent) {
        throw status(404, '父评论不存在或已被删除')
      }

      depth = parent.depth + 1
      rootId = parent.rootId
    }

    const inserted = await db
      .insertInto('galrc_comments')
      .values({
        targetType: targetType as 'post' | 'article' | 'game',
        targetId,
        userId,
        content,
        type: type as CommentType,
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
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        deletedAt: null,
      })
      .returning(['id'])
      .executeTakeFirstOrThrow()

    // For top-level comments, set rootId to the generated id
    if (!parentId) {
      const idStr = String(inserted.id)
      await db
        .updateTable('galrc_comments')
        .set({ rootId: idStr } as any)
        .where('id', '=', inserted.id)
        .execute()
    }

    // Update parent's lastReplyAt
    if (parentId) {
      await db
        .updateTable('galrc_comments')
        .set({ lastReplyAt: now } as any)
        .where('id', '=', parentId)
        .execute()
    }

    // Return the created comment with user info
    const comment = await db
      .selectFrom('galrc_comments')
      .selectAll('galrc_comments')
      .select((eb) => [
        jsonObjectFrom(
          eb
            .selectFrom('galrc_user')
            .whereRef('galrc_user.id', '=', 'galrc_comments.userId')
            .select(['id', 'name', 'image']),
        ).as('user'),
      ])
      .where('id', '=', inserted.id)
      .executeTakeFirstOrThrow()

    return comment
  },

  async updateComment(
    { id }: CommentModel.params,
    { content }: CommentModel.update,
    userId: string,
    role?: string | null,
  ) {
    role = role ?? 'user'

    const comment = await db
      .selectFrom('galrc_comments')
      .selectAll()
      .where('id', '=', id)
      .where('status', '=', 'normal' as CommentStatus)
      .executeTakeFirst()

    if (!comment) {
      throw new Error('评论不存在或已被删除')
    }

    if (comment.userId !== userId || role !== 'admin') {
      throw new Error('无权编辑该评论')
    }

    await db
      .updateTable('galrc_comments')
      .set({ content } as any)
      .where('id', '=', id)
      .execute()

    return { success: true }
  },

  async deleteComment(
    { id }: CommentModel.params,
    userId: string,
    isAdmin: boolean,
  ) {
    const comment = await db
      .selectFrom('galrc_comments')
      .selectAll()
      .where('id', '=', id)
      .where('status', '=', 'normal')
      .executeTakeFirst()
    if (!comment) {
      throw new Error('评论不存在或已被删除')
    }

    if (comment.userId !== userId && !isAdmin) {
      throw new Error('无权删除该评论')
    }

    await db
      .updateTable('galrc_comments')
      .set({
        status: 'deleted',
        deletedAt: new Date(),
      } as any)
      .where('id', '=', id)
      .execute()

    return { success: true }
  },

  async togglePin({ id }: CommentModel.params) {
    const comment = await db
      .selectFrom('galrc_comments')
      .selectAll()
      .where('id', '=', id)
      .where('status', '=', 'normal')
      .executeTakeFirst()

    if (!comment) {
      throw status(404, '评论不存在或已被删除')
    }

    await db
      .updateTable('galrc_comments')
      .set({ isPinned: !comment.isPinned } as any)
      .where('id', '=', id)
      .execute()

    return { isPinned: !comment.isPinned }
  },

  async changeCommentStatus(
    { id }: CommentModel.params,
    { status }: CommentModel.changeStatus,
  ) {
    await db
      .updateTable('galrc_comments')
      .set({
        status: status as CommentStatus,
        ...(status === 'deleted' ? { deletedAt: new Date() } : {}),
      } as any)
      .where('id', '=', id)
      .execute()

    return { success: true }
  },
}
