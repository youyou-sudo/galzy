import {
  buildCoverUrl,
  db,
  eventViews,
  gameDownloadStats,
  images,
  sql,
  transformStoredUrl,
  vn,
  vnTitles,
  zhtags,
} from '@api/libs'
import { getKv, getRedisClient, isRedisEnabled, setKv } from '@api/libs/redis'
import { and, count, desc, eq, gte, inArray } from 'drizzle-orm'
import { status } from 'elysia'
import type { ViewsModel } from './model'

const WEEK_CACHE_TTL = 60 * 5

// ============================================================
// 访问防刷：固定窗口计数（Redis INCR），每 IP 每端点独立限额。
// Redis 不可用时放行（fail-open），避免防刷拖垮正常访问记录。
// ============================================================
const VIEW_RATE_LIMIT = 200
const VIEW_RATE_WINDOW_SECONDS = 60 * 60 * 24

async function hitViewRateLimit(
  ip: string | null,
  scope: 'game' | 'tag',
): Promise<boolean> {
  if (!ip) return false
  // 开发模式 Redis 不生效：防刷逻辑停用，直接放行
  if (!isRedisEnabled) return false
  try {
    const key = `galzy:views:rl:${scope}:${ip}`
    const count = await getRedisClient().incr(key)
    if (count === 1)
      await getRedisClient().expire(key, VIEW_RATE_WINDOW_SECONDS)
    return count > VIEW_RATE_LIMIT
  } catch {
    return false
  }
}

function getWeekStart(): Date {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1
  const weekStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - diff,
  )
  weekStart.setHours(0, 0, 0, 0)
  return weekStart
}

// 周一始终展示上周数据，周二起展示本周数据
function getEffectiveWeekStart(): Date {
  if (new Date().getDay() === 1) {
    const ws = getWeekStart()
    const prev = new Date(ws)
    prev.setDate(prev.getDate() - 7)
    return prev
  }
  return getWeekStart()
}

async function queryGameRankings(weekStart: Date) {
  const result = await db.execute(sql`
    SELECT id, SUM(score)::int AS total FROM (
      SELECT target_id AS id, COUNT(*) * 1 AS score
      FROM galrc_event_views
      WHERE event_type = 'game_view' AND created_at >= ${weekStart}
      GROUP BY target_id
      UNION ALL
      SELECT game_id AS id, COUNT(*) * 3 AS score
      FROM "galrc_gameDownloadStats"
      WHERE created_at >= ${weekStart}
      GROUP BY game_id
    ) combined
    GROUP BY id
    ORDER BY total DESC
    LIMIT 30
  `)
  return result as unknown as Array<{ id: string; total: number }>
}

async function queryTagRankings(weekStart: Date) {
  return db
    .select({
      targetId: eventViews.targetId,
      total: count().mapWith(Number).as('total'),
    })
    .from(eventViews)
    .where(
      and(
        eq(eventViews.eventType, 'tag_view'),
        gte(eventViews.createdAt, weekStart),
      ),
    )
    .groupBy(eventViews.targetId)
    .orderBy(desc(sql`count(*)`))
    .limit(30)
}

export const ViewsService = {
  async recordGameView(
    { gameId }: ViewsModel.recordGameView,
    ip: string | null,
  ) {
    if (await hitViewRateLimit(ip, 'game'))
      throw status(429, '请求过于频繁，请稍后再试喵～')
    await db.insert(eventViews).values({
      eventType: 'game_view',
      targetId: gameId,
      createdAt: new Date(),
    })
  },

  async recordTagView({ tagId }: ViewsModel.recordTagView, ip: string | null) {
    if (await hitViewRateLimit(ip, 'tag'))
      throw status(429, '请求过于频繁，请稍后再试喵～')
    await db.insert(eventViews).values({
      eventType: 'tag_view',
      targetId: tagId,
      createdAt: new Date(),
    })
  },

  async recordTagViews(tagIds: string[]) {
    if (tagIds.length === 0) return
    await db.insert(eventViews).values(
      tagIds.map((tagId) => ({
        eventType: 'tag_view' as const,
        targetId: tagId,
        createdAt: new Date(),
      })),
    )
  },

  async getHotGames(): Promise<ViewsModel.GameRankingItem[]> {
    const weekStart = getEffectiveWeekStart()
    const weekKey = weekStart.toISOString().slice(0, 10)
    const cacheKey = `galzy:views:hot:game:${weekKey}`

    const rows = await queryGameRankings(weekStart)

    if (rows.length === 0) {
      void setKv(cacheKey, JSON.stringify([]), WEEK_CACHE_TTL)
      return []
    }

    const ids = rows.map((r) => r.id)
    // Single query: titles + image data via LEFT JOIN on images
    const titleRows = (await (db
      .select({
        id: vn.id,
        olang: vn.olang,
        imageId: images.id,
        imageWidth: images.width,
        imageHeight: images.height,
        imageUrl: images.url,
        cSexualAvg: images.cSexualAvg,
        titles: sql`COALESCE((SELECT json_agg(row_to_json(t.*)) FROM (SELECT lang, title FROM ${vnTitles} t WHERE t.id = ${sql.identifier('vn')}.${sql.identifier('id')}) t), '[]'::json)`,
      })
      .from(vn)
      .leftJoin(images, eq(vn.cImage, images.id))
      .where(inArray(vn.id, ids)) as any)) as Array<{
      id: string
      olang: string | null
      imageId: string | null
      imageWidth: number | null
      imageHeight: number | null
      cSexualAvg: number | null
      imageUrl: string | null
      titles: Array<{ lang: string; title: string }>
    }>

    const titleMap = new Map<string, string | null>()
    const imageMap = new Map<
      string,
      {
        imageId: string | null
        imageWidth: number | null
        imageHeight: number | null
        cSexualAvg: number | null
        imageUrl: string | null
      }
    >()
    for (const r of titleRows) {
      const titleObj =
        r.titles.find((t) => t.lang === 'zh-Hans') ||
        r.titles.find((t) => t.lang === 'zh') ||
        r.titles.find((t) => t.lang === r.olang)
      titleMap.set(r.id, titleObj?.title ?? null)
      imageMap.set(r.id, {
        imageId: r.imageId,
        imageWidth: r.imageWidth,
        imageUrl: r.imageUrl,
        imageHeight: r.imageHeight,
        cSexualAvg: r.cSexualAvg,
      })
    }

    const result: ViewsModel.GameRankingItem[] = rows.map((r) => {
      const img = imageMap.get(r.id)
      return {
        id: r.id,
        title: titleMap.get(r.id) ?? null,
        total: r.total,
        imageId: img?.imageId ?? null,
        imageWidth: img?.imageWidth ?? null,
        imageHeight: img?.imageHeight ?? null,
        imageUrl: img?.imageId
          ? buildCoverUrl(img.imageId, img.imageWidth, img.imageHeight)
          : transformStoredUrl(img?.imageUrl ?? null),
        cSexualAvg: img?.cSexualAvg ?? null,
      }
    })

    void setKv(cacheKey, JSON.stringify(result), WEEK_CACHE_TTL)
    return result
  },

  async getHotTags(): Promise<ViewsModel.TagRankingItem[]> {
    const weekStart = getEffectiveWeekStart()
    const weekKey = weekStart.toISOString().slice(0, 10)
    const cacheKey = `galzy:views:hot:tag:${weekKey}`
    const cached = await getKv(cacheKey)
    if (cached) return JSON.parse(cached) as ViewsModel.TagRankingItem[]

    const rows = await queryTagRankings(weekStart)

    if (rows.length === 0) {
      void setKv(cacheKey, JSON.stringify([]), WEEK_CACHE_TTL)
      return []
    }

    const tagIds = rows.map((r) => r.targetId)
    const zhtagRows = await db
      .select({
        id: zhtags.id,
        name: zhtags.name,
      })
      .from(zhtags)
      .where(inArray(zhtags.id, tagIds))

    const titleMap = new Map(zhtagRows.map((r) => [r.id, r.name]))

    const result = rows.map((r) => ({
      tag: r.targetId,
      title: titleMap.get(r.targetId) ?? null,
      total: r.total,
    }))

    void setKv(cacheKey, JSON.stringify(result), WEEK_CACHE_TTL)
    return result
  },
}
