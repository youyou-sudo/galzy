import { db } from '@api/libs'
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
import { jsonObjectFrom } from 'kysely/helpers/postgres'
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
        .selectFrom('galrc_article')
        .selectAll()
        .select((eb) => [
          jsonObjectFrom(
            eb
              .selectFrom('galrc_user')
              .whereRef('galrc_user.id', '=', 'galrc_article.author')
              .select(['id', 'name', 'image']),
            // .selectAll(),
          ).as('user'),
        ])
        .where('id', '=', strategyId)
        .executeTakeFirstOrThrow(),
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
        .selectFrom('galrc_article')
        .selectAll()
        .where('type', '=', 'strategy')
        .where(
          isVNDB ? 'vid' : 'otherid',
          '=',
          isVNDB ? gameId : Number(gameId),
        )
        .select((eb) => [
          jsonObjectFrom(
            eb
              .selectFrom('galrc_user')
              .whereRef('galrc_user.id', '=', 'galrc_article.author')
              // .select(['id', 'name', 'image']),
              .selectAll(),
          ).as('user'),
        ])
        .execute(),
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
      .updateTable('galrc_article')
      .where('id', '=', Number(id))
      .set({ ...data })
      .execute()
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
        .insertInto('galrc_article')
        .values({ vid: id, ...data, type: 'strategy', author: userid })
        .executeTakeFirstOrThrow()
    } else {
      await db
        .insertInto('galrc_article')
        .values({
          otherid: Number(id),
          ...data,
          type: 'strategy',
          author: userid,
        })
        .executeTakeFirstOrThrow()
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
      .deleteFrom('galrc_article')
      .where('id', '=', Number(strategyId))
      .returningAll()
      .execute()

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

    let countQuery = db.selectFrom('galrc_article')
    let dataQuery = db.selectFrom('galrc_article')

    if (params.status) {
      countQuery = countQuery.where(
        'status',
        '=',
        params.status as ArticlesStatus,
      )
      dataQuery = dataQuery.where(
        'status',
        '=',
        params.status as ArticlesStatus,
      )
    }
    if (params.type) {
      countQuery = countQuery.where('type', '=', params.type as ArticleType)
      dataQuery = dataQuery.where('type', '=', params.type as ArticleType)
    }
    if (params.search) {
      countQuery = countQuery.where('title', 'ilike', `%${params.search}%`)
      dataQuery = dataQuery.where('title', 'ilike', `%${params.search}%`)
    }

    const [countResult, articles] = await Promise.all([
      countQuery
        .select(db.fn.countAll<number>().as('count'))
        .executeTakeFirst(),
      dataQuery
        .selectAll()
        .select((eb) => [
          jsonObjectFrom(
            eb
              .selectFrom('galrc_user')
              .whereRef('galrc_user.id', '=', 'galrc_article.author')
              .select(['id', 'name', 'image']),
          ).as('user'),
        ])
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .offset(offset)
        .execute(),
    ])

    const total = Number(countResult?.count ?? 0)
    const totalPages = Math.ceil(total / limit)

    const result = { articles, total, totalPages }
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

    const article = await db
      .selectFrom('galrc_article')
      .select(['id', 'vid', 'otherid'])
      .where('id', '=', id)
      .executeTakeFirst()

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
      .updateTable('galrc_article')
      .where('id', '=', id)
      .set({ status: newStatus as ArticlesStatus })
      .execute()

    await storeIdempotentResult(`adminChangeStatus-${hash}`, '', 60)
  },
}

type ArticlesStatus = 'published' | 'hidden' | 'deleted'
type ArticleType = 'strategy' | 'blog' | 'tutorial'
