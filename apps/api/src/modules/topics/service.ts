import { db, topicFavorites, topicLikes, topics, users } from '@api/libs'
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { status } from 'elysia'
import type { TopicModel } from './model'

export const TopicService = {
  async getTopics(
    {
      page = 1,
      limit = 20,
      status: statusFilter = 'published',
    }: TopicModel.list,
    userId?: string,
  ) {
    const offset = (page - 1) * limit

    const conditions = [eq(topics.status, statusFilter)]
    const whereClause = and(...conditions)

    const [topicsData, countResult] = await Promise.all([
      db
        .select({
          id: topics.id,
          userId: topics.userId,
          title: topics.title,
          status: topics.status,
          createdAt: topics.createdAt,
          updatedAt: topics.updatedAt,
          summary: sql<string>`substring(${topics.content}, 1, 400)`.as(
            'summary',
          ),
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

    if (topicsData.length === 0) {
      return { topics: [], total: 0, totalPages: 0 }
    }

    const topicIds = topicsData.map((t) => t.id)
    const userIds = [...new Set(topicsData.map((t) => t.userId))]

    const [usersData, likesData, favsData, userLikes, userFavs] =
      await Promise.all([
        db
          .select({ id: users.id, name: users.name, image: users.image })
          .from(users)
          .where(inArray(users.id, userIds)),
        db
          .select({ topicId: topicLikes.topicId, count: count() })
          .from(topicLikes)
          .where(inArray(topicLikes.topicId, topicIds))
          .groupBy(topicLikes.topicId),
        db
          .select({ topicId: topicFavorites.topicId, count: count() })
          .from(topicFavorites)
          .where(inArray(topicFavorites.topicId, topicIds))
          .groupBy(topicFavorites.topicId),
        userId
          ? db
              .select({ topicId: topicLikes.topicId })
              .from(topicLikes)
              .where(
                and(
                  inArray(topicLikes.topicId, topicIds),
                  eq(topicLikes.userId, userId),
                ),
              )
          : Promise.resolve([]),
        userId
          ? db
              .select({ topicId: topicFavorites.topicId })
              .from(topicFavorites)
              .where(
                and(
                  inArray(topicFavorites.topicId, topicIds),
                  eq(topicFavorites.userId, userId),
                ),
              )
          : Promise.resolve([]),
      ])

    const userMap = new Map(usersData.map((u) => [u.id, u]))
    const likeCountMap = new Map(
      likesData.map((l) => [l.topicId, Number(l.count)]),
    )
    const favCountMap = new Map(
      favsData.map((f) => [f.topicId, Number(f.count)]),
    )
    const userLikeSet = new Set(userLikes.map((l) => l.topicId))
    const userFavSet = new Set(userFavs.map((f) => f.topicId))

    const enrichedTopics = topicsData.map((t) => ({
      ...t,
      user: userMap.get(t.userId) ?? null,
      likeCount: likeCountMap.get(t.id) ?? 0,
      favoriteCount: favCountMap.get(t.id) ?? 0,
      isLiked: userLikeSet.has(t.id),
      isFavorited: userFavSet.has(t.id),
    }))

    const total = Number(countResult?.total ?? 0)
    return {
      topics: enrichedTopics,
      total,
      totalPages: Math.ceil(total / limit),
    }
  },

  async getTopic({ id }: TopicModel.params, userId?: string) {
    const numericId = Number(id)

    const [topic] = await db
      .select()
      .from(topics)
      .where(eq(topics.id, numericId))

    if (!topic) {
      throw status(404, '帖子不存在')
    }

    const [
      [topicUser],
      [likeCountResult],
      [favCountResult],
      isLikedRow,
      isFavoritedRow,
    ] = await Promise.all([
      db
        .select({ id: users.id, name: users.name, image: users.image })
        .from(users)
        .where(eq(users.id, topic.userId)),
      db
        .select({ count: count() })
        .from(topicLikes)
        .where(eq(topicLikes.topicId, numericId)),
      db
        .select({ count: count() })
        .from(topicFavorites)
        .where(eq(topicFavorites.topicId, numericId)),
      userId
        ? db
            .select({ id: topicLikes.id })
            .from(topicLikes)
            .where(
              and(
                eq(topicLikes.topicId, numericId),
                eq(topicLikes.userId, userId),
              ),
            )
            .then((r) => r[0])
        : Promise.resolve(undefined),
      userId
        ? db
            .select({ id: topicFavorites.id })
            .from(topicFavorites)
            .where(
              and(
                eq(topicFavorites.topicId, numericId),
                eq(topicFavorites.userId, userId),
              ),
            )
            .then((r) => r[0])
        : Promise.resolve(undefined),
    ])

    return {
      ...topic,
      user: topicUser ?? null,
      likeCount: Number(likeCountResult?.count ?? 0),
      favoriteCount: Number(favCountResult?.count ?? 0),
      isLiked: !!isLikedRow,
      isFavorited: !!isFavoritedRow,
    }
  },

  async createTopic({ title, content }: TopicModel.create, userId: string) {
    const now = new Date()

    const [topic] = await db
      .insert(topics)
      .values({
        userId,
        title,
        content,
        status: 'published',
        createdAt: now,
        updatedAt: now,
      } as any)
      .returning()

    const [topicUser] = await db
      .select({ id: users.id, name: users.name, image: users.image })
      .from(users)
      .where(eq(users.id, userId))

    return {
      ...topic!,
      user: topicUser ?? null,
      likeCount: 0,
      favoriteCount: 0,
      isLiked: false,
      isFavorited: false,
    }
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
      .select()
      .from(topics)
      .where(eq(topics.id, numericId))

    const [topicUser] = await db
      .select({ id: users.id, name: users.name, image: users.image })
      .from(users)
      .where(eq(users.id, updated!.userId))

    return {
      ...updated!,
      user: topicUser ?? null,
      likeCount: 0,
      favoriteCount: 0,
      isLiked: false,
      isFavorited: false,
    }
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
