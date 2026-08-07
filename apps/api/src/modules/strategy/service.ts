import { createHash } from 'node:crypto'
import { articles, db, sql } from '@api/libs'
import { auth } from '@api/modules/auth/service'
import {
  acquireIdempotentKey,
  delKv,
  delKvPattern,
  generateIdempotentHash,
  getIdempotentResult,
  getKv,
  setKv,
  storeIdempotentResult,
} from '@api/libs/redis'
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  like,
} from 'drizzle-orm'
import { status } from 'elysia'
import type { StrategyModel } from './model'

export interface StrategyListRow {
  id: number
  vid: string | null
  otherid: number | null
  author: string | null
  title: string | null
  type: string | null
  status: string
  copyright: string | null
  content: string | null
  createdAt: Date | null
  updatedAt: Date | null
  user: Record<string, any> | null
}

/** 游戏攻略列表查询：公开仅 published；传 authorId 时查该作者指定状态的未过审文章 */
function strategyListQuery(
  gameId: string,
  options: { authorId?: string; statuses?: string[] } = {},
): Promise<StrategyListRow[]> {
  const isVNDB = /^v\d+$/.test(gameId)
  const conditions = [
    eq(articles.type, 'strategy'),
    isVNDB ? eq(articles.vid, gameId) : eq(articles.otherid, Number(gameId)),
  ]
  if (options.authorId) {
    conditions.push(
      eq(articles.author, options.authorId),
      inArray(articles.status, options.statuses ?? ['pending', 'rejected']),
    )
  } else {
    conditions.push(eq(articles.status, 'published'))
  }
  return db
    .select({
      id: articles.id,
      vid: articles.vid,
      otherid: articles.otherid,
      author: articles.author,
      title: articles.title,
      type: articles.type,
      status: articles.status,
      copyright: articles.copyright,
      content: articles.content,
      createdAt: articles.createdAt,
      updatedAt: articles.updatedAt,
      user: sql<Record<string, any>>`
        (SELECT row_to_json("u".*) FROM (SELECT "id", "name", "image" FROM "galrc_user" WHERE "id" = ${articles.author}) "u")
      `.as('user'),
    })
    .from(articles)
    .where(and(...conditions))
    .limit(50)
}

export const Strategy = {
  async strategy({ strategyId }: StrategyModel.strategy) {
    const redisData = await getKv(`galzy:strategy:${strategyId}`)
    if (redisData !== null && redisData !== undefined) {
      return JSON.parse(redisData) as StrategyContent
    }
    const strategyContent = await db
      .select({
        ...getTableColumns(articles),
        user: sql<{ id: string; name: string; image: string }>`
          (SELECT row_to_json("u".*) FROM (SELECT "id", "name", "image" FROM "galrc_user" WHERE "id" = ${articles.author}) "u")
        `.as('user'),
      })
      .from(articles)
      .where(and(eq(articles.id, strategyId), eq(articles.status, 'published')))
      .then((r) => r[0])
    if (!strategyContent) {
      throw status(404, '文章不存在或未通过审核')
    }
    void setKv(
      `galzy:strategy:${strategyId}`,
      JSON.stringify(strategyContent),
      60 * 60 * 1,
    )
    type StrategyContent = typeof strategyContent
    return strategyContent
  },
  async gameStrategys({
    gameId,
    headers,
  }: StrategyModel.gameStrategys & { headers: Headers }) {
    const redisData = await getKv(`galzy:game:strategys:${gameId}`)
    let data: StrategyListRow[]
    if (redisData !== null && redisData !== undefined) {
      data = JSON.parse(redisData) as StrategyListRow[]
    } else {
      data = await strategyListQuery(gameId)
      void setKv(
        `galzy:game:strategys:${gameId}`,
        JSON.stringify(data),
        60 * 60 * 1,
      )
    }
    // 作者本人的未过审文章实时追加（不缓存，避免跨用户串数据）
    const session = await auth.api.getSession({ headers })
    if (session?.user?.id) {
      const mine = await strategyListQuery(gameId, {
        authorId: session.user.id,
        statuses: ['pending', 'rejected'],
      })
      data = [...mine, ...data]
    }
    return data
  },
  async strategyUpdate({
    id,
    data,
    userid,
    isAdmin,
  }: StrategyModel.strategyListUpdate & { userid: string; isAdmin: boolean }) {
    const [article] = await db
      .select({
        id: articles.id,
        vid: articles.vid,
        otherid: articles.otherid,
        author: articles.author,
        status: articles.status,
      })
      .from(articles)
      .where(eq(articles.id, Number(id)))
    if (!article) {
      throw status(404, '文章不存在')
    }
    const isOwner = article.author === userid
    if (!isAdmin && !isOwner) {
      throw status(403, '无权编辑该文章')
    }
    if (
      !isAdmin &&
      article.status !== 'pending' &&
      article.status !== 'rejected'
    ) {
      throw status(403, '已发布的文章不能直接编辑')
    }
    await delKv(`galzy:strategy:${id}`)
    void delKvPattern('galzy:strategy:admin:articles:*')
    if (article.vid) {
      void delKv(`galzy:game:strategys:${article.vid}`)
    }
    if (article.otherid) {
      void delKv(`galzy:game:strategys:${article.otherid}`)
    }
    const hash = generateIdempotentHash({ id, data })
    const cached = await getIdempotentResult(
      `galzy:idempotent:strategyListUpdate:${hash}`,
    )
    if (cached) {
      return cached
    }
    const ok = await acquireIdempotentKey(
      `galzy:idempotent:strategyListUpdate:${hash}`,
      10,
    )
    if (!ok) {
      throw status(200, '重复请求')
    }
    // 作者编辑被驳回的文章后重新进入审核队列
    const nextStatus =
      !isAdmin && article.status === 'rejected' ? { status: 'pending' } : {}
    await db
      .update(articles)
      .set({ ...data, ...nextStatus })
      .where(eq(articles.id, Number(id)))
    await storeIdempotentResult(
      `galzy:idempotent:strategyListUpdate:${hash}`,
      '',
      60,
    )
  },
  async strategyCreate({
    id,
    data,
    userid,
    isAdmin,
  }: StrategyModel.strategyListCreate & { userid: string; isAdmin: boolean }) {
    await delKv(`galzy:game:strategys:${id}`)
    void delKvPattern('galzy:strategy:admin:articles:*')
    const hash = generateIdempotentHash({ id, data })
    const cached = await getIdempotentResult(
      `galzy:idempotent:strategyListCreate:${hash}`,
    )
    if (cached) {
      return cached
    }
    const ok = await acquireIdempotentKey(
      `galzy:idempotent:strategyListCreate:${hash}`,
      10,
    )
    if (!ok) {
      throw status(200, '重复请求')
    }
    const articleStatus = isAdmin ? 'published' : 'pending'
    const isVNDB = /^v\d+$/.test(id)
    if (isVNDB) {
      await db
        .insert(articles)
        .values({
          vid: id,
          ...data,
          type: 'strategy',
          author: userid,
          status: articleStatus,
        })
    } else {
      await db.insert(articles).values({
        otherid: Number(id),
        ...data,
        type: 'strategy',
        author: userid,
        status: articleStatus,
      })
    }
    await storeIdempotentResult(
      `galzy:idempotent:strategyListCreate:${hash}`,
      '',
      60,
    )
  },
  async strategyDelete({ strategyId, gameId }: StrategyModel.strategy) {
    await delKv(`galzy:game:strategys:${gameId}`)
    void delKvPattern('galzy:strategy:admin:articles:*')
    const hash = generateIdempotentHash({ strategyId })
    const cached = await getIdempotentResult(
      `galzy:idempotent:strategyListDelete:${hash}`,
    )
    if (cached) {
      return cached
    }
    const ok = await acquireIdempotentKey(
      `galzy:idempotent:strategyListDelete:${hash}`,
      10,
    )
    if (!ok) {
      throw status(200, '重复请求')
    }
    await db.delete(articles).where(eq(articles.id, Number(strategyId)))

    await storeIdempotentResult(
      `galzy:idempotent:strategyListDelete:${hash}`,
      '',
      60,
    )
  },
  async adminListAll(params: StrategyModel.adminArticleListQuery): Promise<{
    articles: any[]
    total: number
    totalPages: number
  }> {
    const page = params.page ?? 1
    const limit = params.limit ?? 20
    const offset = (page - 1) * limit

    const cacheKey = `galzy:strategy:admin:articles:${createHash('md5').update(JSON.stringify(params)).digest('hex')}`
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
    const cached = await getIdempotentResult(
      `galzy:idempotent:adminChangeStatus:${hash}`,
    )
    if (cached) {
      return cached
    }
    const ok = await acquireIdempotentKey(
      `galzy:idempotent:adminChangeStatus:${hash}`,
      10,
    )
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

    await delKv(`galzy:strategy:${id}`)
    void delKvPattern('galzy:strategy:admin:articles:*')
    if (article.vid) {
      void delKv(`galzy:game:strategys:${article.vid}`)
    }
    if (article.otherid) {
      void delKv(`galzy:game:strategys:${article.otherid}`)
    }

    await db
      .update(articles)
      .set({ status: newStatus })
      .where(eq(articles.id, id))

    await storeIdempotentResult(
      `galzy:idempotent:adminChangeStatus:${hash}`,
      '',
      60,
    )
  },
}
