import {
  comments,
  db,
  topicFavorites,
  topicLikes,
  topics,
  users,
} from '@api/libs'
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

    const topicIdStrings = topicIds.map(String)
    const [usersData, likesData, favsData, commentCounts, userLikes, userFavs] =
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
        db
          .select({ topicId: comments.targetId, count: count() })
          .from(comments)
          .where(
            and(
              eq(comments.targetType, 'topic'),
              inArray(comments.targetId, topicIdStrings),
            ),
          )
          .groupBy(comments.targetId),
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
    const replyCountMap = new Map(
      commentCounts.map((c) => [Number(c.topicId), Number(c.count)]),
    )
    const userLikeSet = new Set(userLikes.map((l) => l.topicId))
    const userFavSet = new Set(userFavs.map((f) => f.topicId))

    const enrichedTopics = topicsData.map((t) => ({
      ...t,
      user: userMap.get(t.userId) ?? null,
      likeCount: likeCountMap.get(t.id) ?? 0,
      favoriteCount: favCountMap.get(t.id) ?? 0,
      replyCount: replyCountMap.get(t.id) ?? 0,
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

  async getFavorites(
    { page = 1, limit = 20 }: TopicModel.favoritesList,
    userId: string,
  ) {
    const offset = (page - 1) * limit

    const [favRows, countResult] = await Promise.all([
      db
        .select({
          topicId: topicFavorites.topicId,
          favoritedAt: topicFavorites.createdAt,
        })
        .from(topicFavorites)
        .innerJoin(topics, eq(topicFavorites.topicId, topics.id))
        .where(
          and(
            eq(topicFavorites.userId, userId),
            eq(topics.status, 'published'),
          ),
        )
        .orderBy(desc(topicFavorites.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(topicFavorites)
        .innerJoin(topics, eq(topicFavorites.topicId, topics.id))
        .where(
          and(
            eq(topicFavorites.userId, userId),
            eq(topics.status, 'published'),
          ),
        )
        .then((r) => r[0]),
    ])

    if (favRows.length === 0) {
      return { topics: [], total: 0, totalPages: 0 }
    }

    const topicIds = favRows.map((r) => r.topicId)

    const topicsData = await db
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
      .where(inArray(topics.id, topicIds))

    // Preserve favorited order
    const topicMap = new Map(topicsData.map((t) => [t.id, t]))
    const ordered = topicIds
      .map((id) => topicMap.get(id))
      .filter((t): t is NonNullable<typeof t> => t != null)

    const favTopicIdStrings = topicIds.map(String)
    const userIds = [...new Set(ordered.map((t) => t.userId))]

    const [usersData, likesData, favsData, commentCounts, userLikes, userFavs] =
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
        db
          .select({ topicId: comments.targetId, count: count() })
          .from(comments)
          .where(
            and(
              eq(comments.targetType, 'topic'),
              inArray(comments.targetId, favTopicIdStrings),
            ),
          )
          .groupBy(comments.targetId),
        db
          .select({ topicId: topicLikes.topicId })
          .from(topicLikes)
          .where(
            and(
              inArray(topicLikes.topicId, topicIds),
              eq(topicLikes.userId, userId),
            ),
          ),
        db
          .select({ topicId: topicFavorites.topicId })
          .from(topicFavorites)
          .where(
            and(
              inArray(topicFavorites.topicId, topicIds),
              eq(topicFavorites.userId, userId),
            ),
          ),
      ])

    const userMap = new Map(usersData.map((u) => [u.id, u]))
    const likeCountMap = new Map(
      likesData.map((l) => [l.topicId, Number(l.count)]),
    )
    const favCountMap = new Map(
      favsData.map((f) => [f.topicId, Number(f.count)]),
    )
    const replyCountMap = new Map(
      commentCounts.map((c) => [Number(c.topicId), Number(c.count)]),
    )
    const userLikeSet = new Set(userLikes.map((l) => l.topicId))
    const userFavSet = new Set(userFavs.map((f) => f.topicId))

    const enrichedTopics = ordered.map((t) => ({
      ...t,
      user: userMap.get(t.userId) ?? null,
      likeCount: likeCountMap.get(t.id) ?? 0,
      favoriteCount: favCountMap.get(t.id) ?? 0,
      replyCount: replyCountMap.get(t.id) ?? 0,
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
      .select({
        id: topics.id,
        userId: topics.userId,
        title: topics.title,
        content: topics.content,
        status: topics.status,
        createdAt: topics.createdAt,
        updatedAt: topics.updatedAt,
      })
      .from(topics)
      .where(eq(topics.id, numericId))
    if (!topic) {
      throw status(404, '帖子不存在')
    }

    const [topicUser, likesSummary, favsSummary] = await Promise.all([
      db
        .select({ id: users.id, name: users.name, image: users.image })
        .from(users)
        .where(eq(users.id, topic.userId))
        .then((r) => r[0] ?? null),
      db
        .select({
          count: count(),
          userLiked: userId
            ? sql<boolean>`bool_or(${topicLikes.userId} = ${userId})`
            : sql<boolean>`FALSE`,
        })
        .from(topicLikes)
        .where(eq(topicLikes.topicId, numericId))
        .then((r) => r[0] ?? { count: 0, userLiked: false }),
      db
        .select({
          count: count(),
          userFavorited: userId
            ? sql<boolean>`bool_or(${topicFavorites.userId} = ${userId})`
            : sql<boolean>`FALSE`,
        })
        .from(topicFavorites)
        .where(eq(topicFavorites.topicId, numericId))
        .then((r) => r[0] ?? { count: 0, userFavorited: false }),
    ])

    return {
      ...topic,
      user: topicUser,
      likeCount: Number(likesSummary.count),
      favoriteCount: Number(favsSummary.count),
      isLiked: likesSummary.userLiked,
      isFavorited: favsSummary.userFavorited,
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
      .select({
        id: topics.id,
        userId: topics.userId,
        title: topics.title,
        content: topics.content,
        status: topics.status,
        createdAt: topics.createdAt,
        updatedAt: topics.updatedAt,
      })
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

    // Try DELETE first — if row exists, unlike succeeds
    const deleted = await db
      .delete(topicLikes)
      .where(
        and(eq(topicLikes.topicId, numericId), eq(topicLikes.userId, userId)),
      )
      .returning({ id: topicLikes.id })

    const liked = deleted.length === 0
    if (liked) {
      // Row didn't exist — insert it (ON CONFLICT for idempotency)
      await db
        .insert(topicLikes)
        .values({ topicId: numericId, userId })
        .onConflictDoNothing()
    }

    const [countResult] = await db
      .select({ count: count() })
      .from(topicLikes)
      .where(eq(topicLikes.topicId, numericId))

    return {
      liked,
      likeCount: Number(countResult?.count ?? 0),
    }
  },

  async toggleFavorite({ id }: TopicModel.params, userId: string) {
    const numericId = Number(id)

    const deleted = await db
      .delete(topicFavorites)
      .where(
        and(
          eq(topicFavorites.topicId, numericId),
          eq(topicFavorites.userId, userId),
        ),
      )
      .returning({ id: topicFavorites.id })

    const favorited = deleted.length === 0
    if (favorited) {
      await db
        .insert(topicFavorites)
        .values({ topicId: numericId, userId })
        .onConflictDoNothing()
    }

    const [countResult] = await db
      .select({ count: count() })
      .from(topicFavorites)
      .where(eq(topicFavorites.topicId, numericId))

    return {
      favorited,
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
