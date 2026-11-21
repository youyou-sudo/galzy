import {
  articles,
  comments,
  db,
  sanitizeHtml,
  statWindows,
  stripHtml,
  topicFavorites,
  topicLikes,
  users,
} from '@api/libs'
import { ModerationService } from '@api/modules/moderation/service'
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { status } from 'elysia'
import type { TopicModel } from './model'

/** 访问者身份：由路由从服务端会话解析，绝不来自客户端参数。 */
export type TopicViewer = { userId?: string | null; isAdmin?: boolean }

/** 把 Better Auth 会话转成访问者身份（未登录传 null）。 */
export function topicViewerOf(
  session: { user: { id: string; role?: string | null } } | null,
): TopicViewer | null {
  if (!session) return null
  return { userId: session.user.id, isAdmin: session.user.role === 'admin' }
}

/**
 * 帖子可见性：已发布对所有人生效；草稿/隐藏/已删除只对归属者与管理员生效。
 *
 * 评论、点赞、收藏等挂在帖子下的数据都复用它，避免各写一套规则后再次打洞。
 */
function canViewTopic(
  topic: { userId: string | null; status: string },
  viewer?: TopicViewer | null,
): boolean {
  if (topic.status === 'published') return true
  if (viewer?.isAdmin) return true
  return viewer?.userId != null && viewer.userId === topic.userId
}

/**
 * 对挂在帖子下的数据（评论/点赞/收藏）做可见性校验。
 *
 * 帖子不存在、或当前访问者看不到这条帖子时统一抛 404，与帖子详情保持一致：
 * 不暴露帖子是否存在，也不泄漏已删除/未发布帖子的任何内容。
 */
export async function assertTopicVisible(
  id: string | number,
  viewer?: TopicViewer | null,
): Promise<void> {
  const numericId = Number(id)
  if (!Number.isInteger(numericId)) {
    throw status(404, '帖子不存在')
  }

  const [topic] = await db
    .select({ userId: articles.author, status: articles.status })
    .from(articles)
    .where(and(eq(articles.id, numericId), eq(articles.type, 'topic')))

  if (!topic || !canViewTopic(topic, viewer)) {
    throw status(404, '帖子不存在')
  }
}

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

    const conditions = [
      eq(articles.type, 'topic'),
      eq(articles.status, statusFilter),
    ]
    const whereClause = and(...conditions)

    const [topicsData, countResult] = await Promise.all([
      db
        .select({
          id: articles.id,
          userId: articles.author,
          title: articles.title,
          status: articles.status,
          contentType: articles.contentType,
          createdAt: articles.createdAt,
          updatedAt: articles.updatedAt,
          summary: sql<string>`substring(${articles.content}, 1, 400)`.as(
            'summary',
          ),
        })
        .from(articles)
        .where(whereClause)
        .orderBy(desc(articles.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(articles)
        .where(whereClause)
        .then((r) => r[0]),
    ])

    if (topicsData.length === 0) {
      return { topics: [], total: 0, totalPages: 0 }
    }

    const topicIds = topicsData.map((t) => t.id)
    const userIds = [
      ...new Set(
        topicsData.map((t) => t.userId).filter((u): u is string => u != null),
      ),
    ]

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
      summary:
        t.contentType === 'html' ? stripHtml(t.summary ?? '') : t.summary,
      user: userMap.get(t.userId ?? '') ?? null,
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
        .innerJoin(articles, eq(topicFavorites.topicId, articles.id))
        .where(
          and(
            eq(topicFavorites.userId, userId),
            eq(articles.type, 'topic'),
            eq(articles.status, 'published'),
          ),
        )
        .orderBy(desc(topicFavorites.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(topicFavorites)
        .innerJoin(articles, eq(topicFavorites.topicId, articles.id))
        .where(
          and(
            eq(topicFavorites.userId, userId),
            eq(articles.type, 'topic'),
            eq(articles.status, 'published'),
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
        id: articles.id,
        userId: articles.author,
        title: articles.title,
        status: articles.status,
        contentType: articles.contentType,
        createdAt: articles.createdAt,
        updatedAt: articles.updatedAt,
        summary: sql<string>`substring(${articles.content}, 1, 400)`.as(
          'summary',
        ),
      })
      .from(articles)
      .where(inArray(articles.id, topicIds))

    // Preserve favorited order
    const topicMap = new Map(topicsData.map((t) => [t.id, t]))
    const ordered = topicIds
      .map((id) => topicMap.get(id))
      .filter((t): t is NonNullable<typeof t> => t != null)

    const favTopicIdStrings = topicIds.map(String)
    const userIds = [
      ...new Set(
        ordered.map((t) => t.userId).filter((u): u is string => u != null),
      ),
    ]

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
      summary:
        t.contentType === 'html' ? stripHtml(t.summary ?? '') : t.summary,
      user: userMap.get(t.userId ?? '') ?? null,
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

  async getLikes(
    { page = 1, limit = 20 }: TopicModel.likesList,
    userId: string,
  ) {
    const offset = (page - 1) * limit

    const [likeRows, countResult] = await Promise.all([
      db
        .select({
          topicId: topicLikes.topicId,
          likedAt: topicLikes.createdAt,
        })
        .from(topicLikes)
        .innerJoin(articles, eq(topicLikes.topicId, articles.id))
        .where(
          and(
            eq(topicLikes.userId, userId),
            eq(articles.type, 'topic'),
            eq(articles.status, 'published'),
          ),
        )
        .orderBy(desc(topicLikes.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(topicLikes)
        .innerJoin(articles, eq(topicLikes.topicId, articles.id))
        .where(
          and(
            eq(topicLikes.userId, userId),
            eq(articles.type, 'topic'),
            eq(articles.status, 'published'),
          ),
        )
        .then((r) => r[0]),
    ])

    if (likeRows.length === 0) {
      return { topics: [], total: 0, totalPages: 0 }
    }

    const topicIds = likeRows.map((r) => r.topicId)

    const topicsData = await db
      .select({
        id: articles.id,
        userId: articles.author,
        title: articles.title,
        status: articles.status,
        contentType: articles.contentType,
        createdAt: articles.createdAt,
        updatedAt: articles.updatedAt,
        summary: sql<string>`substring(${articles.content}, 1, 400)`.as(
          'summary',
        ),
      })
      .from(articles)
      .where(inArray(articles.id, topicIds))

    // Preserve liked order
    const topicMap = new Map(topicsData.map((t) => [t.id, t]))
    const ordered = topicIds
      .map((id) => topicMap.get(id))
      .filter((t): t is NonNullable<typeof t> => t != null)

    const likeTopicIdStrings = topicIds.map(String)
    const userIds = [
      ...new Set(
        ordered.map((t) => t.userId).filter((u): u is string => u != null),
      ),
    ]

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
              inArray(comments.targetId, likeTopicIdStrings),
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
      summary:
        t.contentType === 'html' ? stripHtml(t.summary ?? '') : t.summary,
      user: userMap.get(t.userId ?? '') ?? null,
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

  async getTopic({ id }: TopicModel.params, viewer?: TopicViewer | null) {
    const numericId = Number(id)
    const userId = viewer?.userId ?? undefined

    const [topic] = await db
      .select({
        id: articles.id,
        userId: articles.author,
        title: articles.title,
        content: articles.content,
        contentType: articles.contentType,
        status: articles.status,
        createdAt: articles.createdAt,
        updatedAt: articles.updatedAt,
      })
      .from(articles)
      .where(and(eq(articles.id, numericId), eq(articles.type, 'topic')))
    if (!topic) {
      throw status(404, '帖子不存在')
    }

    // 草稿/隐藏/已删除等非公开帖子只对归属者与管理员可见：对其他人一律按
    // 不存在处理，既不暴露帖子是否存在，也不泄漏正文。
    if (!canViewTopic(topic, viewer)) {
      throw status(404, '帖子不存在')
    }

    const [topicUser, likesSummary, favsSummary, viewsSummary] =
      await Promise.all([
        db
          .select({ id: users.id, name: users.name, image: users.image })
          .from(users)
          .where(eq(users.id, topic.userId ?? ''))
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
        // 阅读数：写时增量表按 (kind='topic_view', target_id) 累计求和，
        // 主键前缀命中即可（与 views 模块上报的 target 口径一致，见 libs/stats.ts）
        db
          .select({
            total: sql<number>`COALESCE(SUM(${statWindows.total}), 0)::int`,
          })
          .from(statWindows)
          .where(
            and(
              eq(statWindows.kind, 'topic_view'),
              eq(statWindows.targetId, String(numericId)),
            ),
          )
          .then((r) => r[0] ?? { total: 0 }),
      ])

    return {
      ...topic,
      user: topicUser,
      likeCount: Number(likesSummary.count),
      favoriteCount: Number(favsSummary.count),
      viewCount: Number(viewsSummary.total),
      isLiked: likesSummary.userLiked,
      isFavorited: favsSummary.userFavorited,
    }
  },

  async createTopic(
    { title, content, contentType = 'markdown' }: TopicModel.create,
    userId: string,
  ) {
    const now = new Date()

    const safeContent = contentType === 'html' ? sanitizeHtml(content) : content

    const [inserted] = await db
      .insert(articles)
      .values({
        author: userId,
        title,
        content: safeContent,
        contentType,
        type: 'topic',
        status: 'published',
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    // 大模型内容审核：入队同步写一行，模型调用在后台跑（未启用时直接跳过）。
    // HTML 正文原样送审（href 本身就是广告识别的重要信号，不能先剥标签）。
    try {
      await ModerationService.enqueueInspection({
        targetType: 'topic',
        targetId: String(inserted!.id),
        userId,
        title,
        content: safeContent,
      })
    } catch (error) {
      console.error('[moderation] 帖子送审入队失败:', error)
    }

    // 与列表/详情返回结构一致：author 列以 userId 字段对外暴露
    const topic = {
      id: inserted!.id,
      userId: inserted!.author,
      title: inserted!.title,
      content: inserted!.content,
      status: inserted!.status,
      createdAt: inserted!.createdAt,
      updatedAt: inserted!.updatedAt,
    }

    const [topicUser] = await db
      .select({ id: users.id, name: users.name, image: users.image })
      .from(users)
      .where(eq(users.id, userId))

    return {
      ...topic!,
      user: topicUser ?? null,
      likeCount: 0,
      favoriteCount: 0,
      // 与 getTopic 返回结构对齐（新帖还没有任何阅读记录）
      viewCount: 0,
      isLiked: false,
      isFavorited: false,
    }
  },

  async updateTopic(
    {
      id,
      title,
      content,
      contentType,
      status: newStatus,
    }: {
      id: string
      title?: string
      content?: string
      contentType?: 'markdown' | 'html'
      status?: string
    },
    userId: string,
    role?: string | null,
  ) {
    const numericId = Number(id)

    const [topic] = await db
      .select({
        id: articles.id,
        userId: articles.author,
        status: articles.status,
      })
      .from(articles)
      .where(and(eq(articles.id, numericId), eq(articles.type, 'topic')))

    if (!topic) {
      throw status(404, '帖子不存在')
    }

    if (topic.userId !== userId && role !== 'admin') {
      throw status(403, '无权编辑该帖子')
    }

    // 发布/隐藏/删除这类状态变更只有管理员能做：否则作者可以自己把被审核
    // 删除或被隐藏的帖子改回 published。
    if (
      newStatus !== undefined &&
      newStatus !== topic.status &&
      role !== 'admin'
    ) {
      throw status(403, '只有管理员可以修改帖子状态')
    }

    const updateData: Record<string, string | Date> = {}
    if (title !== undefined) updateData.title = title
    if (content !== undefined) {
      updateData.content =
        contentType === 'html' ? sanitizeHtml(content) : content
    }
    if (contentType !== undefined) updateData.contentType = contentType
    if (newStatus !== undefined) updateData.status = newStatus
    updateData.updatedAt = new Date()

    await db.update(articles).set(updateData).where(eq(articles.id, numericId))

    const [updated] = await db
      .select({
        id: articles.id,
        userId: articles.author,
        title: articles.title,
        content: articles.content,
        status: articles.status,
        createdAt: articles.createdAt,
        updatedAt: articles.updatedAt,
      })
      .from(articles)
      .where(eq(articles.id, numericId))

    const [topicUser] = await db
      .select({ id: users.id, name: users.name, image: users.image })
      .from(users)
      .where(eq(users.id, updated!.userId ?? ''))

    return {
      ...updated!,
      user: topicUser ?? null,
      likeCount: 0,
      favoriteCount: 0,
      // 编辑不改阅读数：这里只用于回显，真实值以 getTopic 为准
      viewCount: 0,
      isLiked: false,
      isFavorited: false,
    }
  },

  async toggleLike({ id }: TopicModel.params, userId: string) {
    const numericId = Number(id)

    // 未发布/已删除的帖子不接受互动：与帖子详情保持同一套可见性规则
    await assertTopicVisible(numericId, null)

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

    // 未发布/已删除的帖子不接受互动：与帖子详情保持同一套可见性规则
    await assertTopicVisible(numericId, null)

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
        id: articles.id,
        userId: articles.author,
      })
      .from(articles)
      .where(and(eq(articles.id, numericId), eq(articles.type, 'topic')))

    if (!topic) {
      throw status(404, '帖子不存在')
    }

    if (topic.userId !== userId && role !== 'admin') {
      throw status(403, '无权删除该帖子')
    }

    await db
      .update(articles)
      .set({ status: 'deleted', updatedAt: new Date() })
      .where(eq(articles.id, numericId))

    return { success: true }
  },
}
