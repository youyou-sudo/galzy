import { db, eventViews, sql, vn, vnTitles, zhtags } from '@api/libs'
import { getKv, setKv } from '@api/libs/redis'
import { and, count, desc, eq, gte, inArray } from 'drizzle-orm'
import type { ViewsModel } from './model'

const WEEK_CACHE_TTL = 60 * 5

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
  return db
    .select({
      id: eventViews.targetId,
      total: count().mapWith(Number).as('total'),
    })
    .from(eventViews)
    .where(
      and(
        eq(eventViews.eventType, 'game_view'),
        gte(eventViews.createdAt, weekStart),
      ),
    )
    .groupBy(eventViews.targetId)
    .orderBy(desc(sql`count(*)`))
    .limit(30)
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
  async recordGameView({ gameId }: ViewsModel.recordGameView) {
    await db.insert(eventViews).values({
      eventType: 'game_view',
      targetId: gameId,
      createdAt: new Date(),
    })
  },

  async recordTagView({ tagId }: ViewsModel.recordTagView) {
    await db.insert(eventViews).values({
      eventType: 'tag_view',
      targetId: tagId,
      createdAt: new Date(),
    })
  },

  async getHotGames(): Promise<ViewsModel.GameRankingItem[]> {
    const weekStart = getEffectiveWeekStart()
    const weekKey = weekStart.toISOString().slice(0, 10)
    const cacheKey = `galzy:views:hot:game:${weekKey}`
    const cached = await getKv(cacheKey)
    if (cached) return JSON.parse(cached) as ViewsModel.GameRankingItem[]

    const rows = await queryGameRankings(weekStart)

    if (rows.length === 0) {
      void setKv(cacheKey, JSON.stringify([]), WEEK_CACHE_TTL)
      return []
    }

    const ids = rows.map((r) => r.id)
    const titleRows = (await (db
      .select({
        id: vn.id,
        olang: vn.olang,
        titles: sql`COALESCE((SELECT json_agg(row_to_json(t.*)) FROM (SELECT lang, title FROM ${vnTitles} t WHERE t.id = ${sql.identifier('vn')}.${sql.identifier('id')}) t), '[]'::json)`,
      })
      .from(vn)
      .where(inArray(vn.id, ids)) as any)) as Array<{
      id: string
      olang: string | null
      titles: Array<{ lang: string; title: string }>
    }>

    const titleMap = new Map(
      titleRows.map((r) => {
        const titleObj =
          r.titles.find((t) => t.lang === 'zh-Hans') ||
          r.titles.find((t) => t.lang === 'zh') ||
          r.titles.find((t) => t.lang === r.olang)
        return [r.id, titleObj?.title ?? null] as const
      }),
    )

    const result = rows.map((r) => ({
      id: r.id,
      title: titleMap.get(r.id) ?? null,
      total: r.total,
    }))

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
