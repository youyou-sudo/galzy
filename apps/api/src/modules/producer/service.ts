import { db } from '@api/libs'
import { delKv, getKv, setKv } from '@api/libs/redis'
import { status } from 'elysia'
import { jsonArrayFrom } from 'kysely/helpers/postgres'
import { t } from 'try'
import type { ProducerModel } from './model'

export const Producer = {
  async info({ pid }: ProducerModel.ProducerGet) {
    const redisKey = `Producerinfo-${pid}`
    const redisData = await getKv(redisKey)
    if (redisData !== null && redisData !== undefined) {
      return JSON.parse(redisData) as Producer
    }

    const [, error, producer] = t(
      await db
        .selectFrom('producers')
        .where('producers.id', '=', pid)
        .selectAll()
        .select((eb) => [
          jsonArrayFrom(
            eb
              .selectFrom('producers_relations')
              .where('producers_relations.id', '=', pid)
              .innerJoin('producers', 'producers.id', 'producers_relations.pid')
              .select([
                'producers_relations.id',
                'producers_relations.pid',
                'producers.alias',
                'producers.name',
                'producers_relations.relation',
              ]),
          ).as('producers_relations'),
        ])
        .executeTakeFirst(),
    )

    if (!producer) throw status(404, `未找到 pid 为 ${pid} 的 producer`)

    if (error)
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)

    type Producer = typeof producer

    void setKv(redisKey, JSON.stringify(producer), 60 * 30)

    return producer
  },
  async gamelists({ pid }: ProducerModel.ProducerGet) {
    const redisKey = `ProducerGameLists-${pid}`
    const redisData = await getKv(redisKey)
    if (redisData) {
      try {
        return JSON.parse(redisData) as Producergamelists
      } catch {
        await delKv(redisKey)
      }
    }

    const [, error, producerGamelists] = t(
      await db
        .selectFrom('releases_producers')
        .innerJoin('releases_vn', 'releases_vn.id', 'releases_producers.id')
        .innerJoin('vn', 'vn.id', 'releases_vn.vid')
        .innerJoin('images', 'images.id', 'vn.c_image')
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom('galrc_alistb')
              .select('galrc_alistb.vid')
              .whereRef('galrc_alistb.vid', '=', 'releases_vn.vid'),
          ),
        )
        .distinctOn(['vn.id'])
        .orderBy('vn.id')
        .orderBy('releases_vn.vid')
        .where('releases_producers.pid', '=', pid)
        .select((eb) => [
          'vn.id',
          'vn.alias',
          'vn.description',
          'vn.olang',
          'images.id as image_id',
          'images.width as image_width',
          'images.height as image_height',
          jsonArrayFrom(
            eb
              .selectFrom('vn_titles')
              .whereRef('vn_titles.id', '=', 'vn.id')
              .select([
                'vn_titles.lang',
                'vn_titles.official',
                'vn_titles.title',
                'vn_titles.latin',
              ]),
          ).as('titles'),
        ])
        .execute(),
    )

    type Producergamelists = typeof producerGamelists

    if (!producerGamelists) throw status(404, `未找到该生产者的游戏列表喵~`)

    if (error)
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)

    void setKv(redisKey, JSON.stringify(producerGamelists), 60 * 30)

    return producerGamelists
  },
}
