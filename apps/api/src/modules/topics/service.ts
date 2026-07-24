import { db, sql, topicFavorites, topicLikes, topics } from '@api/libs'
import { and, count, desc, eq, getTableColumns } from 'drizzle-orm'
import { status } from 'elysia'
import type { TopicModel } from './model'

export const TopicService = {
  async getTopics({
    page = 1,
    limit = 20,
    status: statusFilter = 'published',
    userId,
  }: TopicModel.list & { userId?: string }) {
    const offset = (page - 1) * limit

    const conditions: any[] = []

    if (statusFilter) {
      conditions.push(eq(topics.status, statusFilter))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [topicsData, countResult] = await Promise.all([
      db
        .select({
          ...getTableColumns(topics),
          user: sql<{ id: string; name: string; image: string }>`
            (SELECT row_to_json("u".*) FROM (SELECT "id", "name", "image" FROM "galrc_user" WHERE "id" = ${topics.userId}) "u")
          `.as('user'),
          likeCount:
            sql<number>`COALESCE((SELECT COUNT(*) FROM "galrc_topic_likes" WHERE "topicId" = ${topics.id}), 0)`.as(
              'likeCount',
            ),
          favoriteCount:
            sql<number>`COALESCE((SELECT COUNT(*) FROM "galrc_topic_favorites" WHERE "topicId" = ${topics.id}), 0)`.as(
              'favoriteCount',
            ),
          ...(userId
            ? {
                isLiked:
                  sql<boolean>`EXISTS(SELECT 1 FROM "galrc_topic_likes" WHERE "topicId" = ${topics.id} AND "userId" = ${userId})`.as(
                    'isLiked',
                  ),
                isFavorited:
                  sql<boolean>`EXISTS(SELECT 1 FROM "galrc_topic_favorites" WHERE "topicId" = ${topics.id} AND "userId" = ${userId})`.as(
                    'isFavorited',
                  ),
              }
            : {}),
        })
        .from(topics)
        .where(whereClause)
        .orderBy(desc(topics.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(topics)
        .where(whereClause)
        .then((r) => r[0]),
    ])

    const total = Number(countResult?.total ?? 0)

    return {
      topics: topicsData,
      total,
      totalPages: Math.ceil(total / limit),
    }
  },

  async getTopic({ id }: TopicModel.params, userId?: string) {
    const numericId = Number(id)

    const [topic] = await db
      .select({
        ...getTableColumns(topics),
        user: sql<{ id: string; name: string; image: string }>`
          (SELECT row_to_json("u".*) FROM (SELECT "id", "name", "image" FROM "galrc_user" WHERE "id" = ${topics.userId}) "u")
        `.as('user'),
        likeCount:
          sql<number>`COALESCE((SELECT COUNT(*) FROM "galrc_topic_likes" WHERE "topicId" = ${topics.id}), 0)`.as(
            'likeCount',
          ),
        favoriteCount:
          sql<number>`COALESCE((SELECT COUNT(*) FROM "galrc_topic_favorites" WHERE "topicId" = ${topics.id}), 0)`.as(
            'favoriteCount',
          ),
        ...(userId
          ? {
              isLiked:
                sql<boolean>`EXISTS(SELECT 1 FROM "galrc_topic_likes" WHERE "topicId" = ${topics.id} AND "userId" = ${userId})`.as(
                  'isLiked',
                ),
              isFavorited:
                sql<boolean>`EXISTS(SELECT 1 FROM "galrc_topic_favorites" WHERE "topicId" = ${topics.id} AND "userId" = ${userId})`.as(
                  'isFavorited',
                ),
            }
          : {}),
      })
      .from(topics)
      .where(eq(topics.id, numericId))

    if (!topic) {
      throw status(404, '帖子不存在')
    }

    return topic
  },

  async createTopic({ title, content }: TopicModel.create, userId: string) {
    const now = new Date()

    const [inserted] = await db
      .insert(topics)
      .values({
        userId,
        title,
        content,
        status: 'published',
        createdAt: now,
        updatedAt: now,
      } as any)
      .returning({ id: topics.id })

    const [topic] = await db
      .select({
        ...getTableColumns(topics),
        user: sql<{ id: string; name: string; image: string }>`
          (SELECT row_to_json("u".*) FROM (SELECT "id", "name", "image" FROM "galrc_user" WHERE "id" = ${topics.userId}) "u")
        `.as('user'),
      })
      .from(topics)
      .where(eq(topics.id, inserted.id))

    return topic!
  },

  async updateTopic(
    {
      id,
      title,
      content,
      status: newStatus,
    }: { id: string; title?: string; content?: string; status?: string },
    userId: string,
    role?: string | null,
  ) {
    const numericId = Number(id)

    const [topic] = await db
      .select({
        id: topics.id,
        userId: topics.userId,
      })
      .from(topics)
      .where(eq(topics.id, numericId))

    if (!topic) {
      throw status(404, '帖子不存在')
    }

    if (topic.userId !== userId && role !== 'admin') {
      throw status(403, '无权编辑该帖子')
    }

    const updateData: Record<string, any> = {}
    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (newStatus !== undefined) updateData.status = newStatus
    updateData.updatedAt = new Date()

    await db.update(topics).set(updateData).where(eq(topics.id, numericId))

    const [updated] = await db
      .select({
        ...getTableColumns(topics),
        user: sql<{ id: string; name: string; image: string }>`
          (SELECT row_to_json("u".*) FROM (SELECT "id", "name", "image" FROM "galrc_user" WHERE "id" = ${topics.userId}) "u")
        `.as('user'),
      })
      .from(topics)
      .where(eq(topics.id, numericId))

    return updated!
  },

  async toggleLike({ id }: TopicModel.params, userId: string) {
    const numericId = Number(id)

    const [topic] = await db
      .select({ id: topics.id })
      .from(topics)
      .where(eq(topics.id, numericId))

    if (!topic) {
      throw status(404, '帖子不存在')
    }

    const [existing] = await db
      .select({ id: topicLikes.id })
      .from(topicLikes)
      .where(
        and(eq(topicLikes.topicId, numericId), eq(topicLikes.userId, userId)),
      )

    if (existing) {
      await db
        .delete(topicLikes)
        .where(
          and(eq(topicLikes.topicId, numericId), eq(topicLikes.userId, userId)),
        )
    } else {
      await db.insert(topicLikes).values({ topicId: numericId, userId })
    }

    const [countResult] = await db
      .select({ count: count() })
      .from(topicLikes)
      .where(eq(topicLikes.topicId, numericId))

    return {
      liked: !existing,
      likeCount: Number(countResult?.count ?? 0),
    }
  },

  async toggleFavorite({ id }: TopicModel.params, userId: string) {
    const numericId = Number(id)

    const [topic] = await db
      .select({ id: topics.id })
      .from(topics)
      .where(eq(topics.id, numericId))

    if (!topic) {
      throw status(404, '帖子不存在')
    }

    const [existing] = await db
      .select({ id: topicFavorites.id })
      .from(topicFavorites)
      .where(
        and(
          eq(topicFavorites.topicId, numericId),
          eq(topicFavorites.userId, userId),
        ),
      )

    if (existing) {
      await db
        .delete(topicFavorites)
        .where(
          and(
            eq(topicFavorites.topicId, numericId),
            eq(topicFavorites.userId, userId),
          ),
        )
    } else {
      await db.insert(topicFavorites).values({ topicId: numericId, userId })
    }

    const [countResult] = await db
      .select({ count: count() })
      .from(topicFavorites)
      .where(eq(topicFavorites.topicId, numericId))

    return {
      favorited: !existing,
      favoriteCount: Number(countResult?.count ?? 0),
    }
  },

  async deleteTopic(
    { id }: TopicModel.params,
    userId: string,
    role?: string | null,
  ) {
    const numericId = Number(id)

    const [topic] = await db
      .select({
        id: topics.id,
        userId: topics.userId,
      })
      .from(topics)
      .where(eq(topics.id, numericId))

    if (!topic) {
      throw status(404, '帖子不存在')
    }

    if (topic.userId !== userId && role !== 'admin') {
      throw status(403, '无权删除该帖子')
    }

    await db
      .update(topics)
      .set({ status: 'deleted', updatedAt: new Date() })
      .where(eq(topics.id, numericId))

    return { success: true }
  },
}
