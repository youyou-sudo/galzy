import { db } from '@api/libs'
import {
  acquireIdempotentKey,
  delKv,
  getIdempotentResult,
  getKv,
  setKv,
  storeIdempotentResult,
} from '@api/libs/redis'
import { status } from 'elysia'
import { t } from 'try'
import XXH from 'xxhashjs'
import type { StrategyModel } from './model'
import { jsonObjectFrom } from 'kysely/helpers/postgres'

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
        .select(
          (eb) => [
            jsonObjectFrom(
              eb
                .selectFrom('galrc_user')
                .whereRef('galrc_user.id', '=', 'galrc_article.author')
                .select(['id', 'name', 'image']),
            ).as('user'),
          ]
        )
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
    const str = JSON.stringify({ id, data })
    const hash = XXH.h32(str, 0xabcd).toString(16)
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
    const str = JSON.stringify({ id, data })
    const hash = XXH.h32(str, 0xabcd).toString(16)
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
        .values({ otherid: Number(id), ...data, type: 'strategy' })
        .executeTakeFirstOrThrow()
    }
    await storeIdempotentResult(`strategyListCreate-${hash}`, '', 60)
  },
  async strategyDelete({ strategyId, gameId }: StrategyModel.strategy) {
    await delKv(`gameStrategys:${gameId}`)
    const str = JSON.stringify({ strategyId })
    const hash = XXH.h32(str, 0xabcd).toString(16)
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
}
