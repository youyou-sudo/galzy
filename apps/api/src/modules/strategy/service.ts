import { db, sql, articles } from '@api/libs'
import {
  acquireIdempotentKey,
  delKv,
  generateIdempotentHash,
  getIdempotentResult,
  getKv,
  setKv,
  storeIdempotentResult,
} from '@api/libs/redis'
import { status } from 'elysia'
import { eq, and, desc, like, count, getTableColumns } from 'drizzle-orm'
import { t } from 'try'
import type { StrategyModel } from './model'

export const Strategy = {
  async strategy({ strategyId }: StrategyModel.strategy) {
    const redisData = await getKv(`strategy-${strategyId}`)
    if (redisData !== null && redisData !== undefined) {
      return JSON.parse(redisData) as StrategyContent
    }
    const [, error, strategyContent] = t(
      await db
        .select({
          ...getTableColumns(articles),
          user: sql<{ id: string; name: string; image: string }>`
            (SELECT row_to_json("u".*) FROM (SELECT "id", "name", "image" FROM "galrc_user" WHERE "id" = ${articles.author}) "u")
          `.as('user'),
        })
        .from(articles)
        .where(eq(articles.id, strategyId))
        .then((r) => r[0]),
    )
    if (error)
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    void setKv(
      `strategy-${strategyId}`,
      JSON.stringify(strategyContent),
      60 * 60 * 1,
    )
    type StrategyContent = typeof strategyContent
    return strategyContent
  },
  async gameStrategys({ gameId }: StrategyModel.gameStrategys) {
    const redisData = await getKv(`gameStrategys:${gameId}`)
    if (redisData !== null && redisData !== undefined) {
      return JSON.parse(redisData) as StrategyContent
    }
    const isVNDB = /^v\d+$/.test(gameId)
    const [, error, data] = t(
      await db
        .select({
          ...getTableColumns(articles),
          user: sql<Record<string, any>>`
            (SELECT row_to_json("u".*) FROM (SELECT * FROM "galrc_user" WHERE "id" = ${articles.author}) "u")
          `.as('user'),
        })
        .from(articles)
        .where(
          and(
            eq(articles.type, 'strategy'),
            isVNDB
              ? eq(articles.vid, gameId)
              : eq(articles.otherid, Number(gameId)),
          ),
        ),
    )
    if (error)
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    void setKv(`gameStrategys:${gameId}`, JSON.stringify(data), 60 * 60 * 1)
    type StrategyContent = typeof data
    return data
  },
  async strategyUpdate({ id, data }: StrategyModel.strategyListUpdate) {
    await delKv(`gameStrategys:${id}`)
    await delKv(`strategy-${id}`)
    const hash = generateIdempotentHash({ id, data })
    const cached = await getIdempotentResult(`strategyListUpdate-${hash}`)
    if (cached) {
      return cached
    }
    const ok = await acquireIdempotentKey(`strategyListUpdate-${hash}`, 10)
    if (!ok) {
      throw status(200, '重复请求')
    }
    await db
      .update(articles)
      .set({ ...data })
      .where(eq(articles.id, Number(id)))
    await storeIdempotentResult(`strategyListUpdate-${hash}`, '', 60)
  },
  async strategyCreate({ id, data, userid }: StrategyModel.strategyListCreate) {
    await delKv(`gameStrategys:${id}`)
    const hash = generateIdempotentHash({ id, data })
    const cached = await getIdempotentResult(`strategyListCreate-${hash}`)
    if (cached) {
      return cached
    }
    const ok = await acquireIdempotentKey(`strategyListCreate-${hash}`, 10)
    if (!ok) {
      throw status(200, '重复请求')
    }
    const isVNDB = /^v\d+$/.test(id)
    if (isVNDB) {
      await db
        .insert(articles)
        .values({ vid: id, ...data, type: 'strategy', author: userid })
    } else {
      await db
        .insert(articles)
        .values({
          otherid: Number(id),
          ...data,
          type: 'strategy',
          author: userid,
        })
    }
    await storeIdempotentResult(`strategyListCreate-${hash}`, '', 60)
  },
  async strategyDelete({ strategyId, gameId }: StrategyModel.strategy) {
    await delKv(`gameStrategys:${gameId}`)
    const hash = generateIdempotentHash({ strategyId })
    const cached = await getIdempotentResult(`strategyListDelete-${hash}`)
    if (cached) {
      return cached
    }
    const ok = await acquireIdempotentKey(`strategyListDelete-${hash}`, 10)
    if (!ok) {
      throw status(200, '重复请求')
    }
    await db
      .delete(articles)
      .where(eq(articles.id, Number(strategyId)))

    await storeIdempotentResult(`strategyListDelete-${hash}`, '', 60)
  },
  async adminListAll(params: StrategyModel.adminArticleListQuery): Promise<{
    articles: any[]
    total: number
    totalPages: number
  }> {
    const page = params.page ?? 1
    const limit = params.limit ?? 20
    const offset = (page - 1) * limit

    const cacheKey = `adminArticles:${JSON.stringify(params)}`
    const redisData = await getKv(cacheKey)
    if (redisData !== null && redisData !== undefined) {
      return JSON.parse(redisData) as any
    }

    const conditions: any[] = []

    if (params.status) {
      conditions.push(eq(articles.status, params.status))
    }
    if (params.type) {
      conditions.push(eq(articles.type, params.type))
    }
    if (params.search) {
      conditions.push(like(articles.title, `%${params.search}%`))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [countResult, articlesData] = await Promise.all([
      db
        .select({ count: count() })
        .from(articles)
        .where(whereClause)
        .then((r) => r[0]),
      db
        .select({
          ...getTableColumns(articles),
          user: sql<{ id: string; name: string; image: string }>`
            (SELECT row_to_json("u".*) FROM (SELECT "id", "name", "image" FROM "galrc_user" WHERE "id" = ${articles.author}) "u")
          `.as('user'),
        })
        .from(articles)
        .where(whereClause)
        .orderBy(desc(articles.createdAt))
        .limit(limit)
        .offset(offset),
    ])

    const total = Number(countResult?.count ?? 0)
    const totalPages = Math.ceil(total / limit)

    const result = { articles: articlesData, total, totalPages }
    void setKv(cacheKey, JSON.stringify(result), 60)
    return result
  },
  async adminChangeStatus({
    id,
    status: newStatus,
  }: StrategyModel.adminArticleStatus) {
    const hash = generateIdempotentHash({ id, status: newStatus })
    const cached = await getIdempotentResult(`adminChangeStatus-${hash}`)
    if (cached) {
      return cached
    }
    const ok = await acquireIdempotentKey(`adminChangeStatus-${hash}`, 10)
    if (!ok) {
      throw status(200, '重复请求')
    }

    const [article] = await db
      .select({
        id: articles.id,
        vid: articles.vid,
        otherid: articles.otherid,
      })
      .from(articles)
      .where(eq(articles.id, id))

    if (!article) {
      throw status(404, '文章不存在')
    }

    await delKv(`strategy-${id}`)
    if (article.vid) {
      void delKv(`gameStrategys:${article.vid}`)
    }
    if (article.otherid) {
      void delKv(`gameStrategys:${article.otherid}`)
    }

    await db
      .update(articles)
      .set({ status: newStatus })
      .where(eq(articles.id, id))

    await storeIdempotentResult(`adminChangeStatus-${hash}`, '', 60)
  },
}
