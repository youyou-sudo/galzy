import { db } from '@api/libs'
import { producers, releasesProducers, releasesVn, vn, images, vnTitles } from '@api/libs'
import { delKv, getKv, setKv } from '@api/libs/redis'
import { status } from 'elysia'
import { eq, and, sql, getTableColumns, inArray } from 'drizzle-orm'
import { t } from 'try'
import type { ProducerModel } from './model'

export const Producer = {
  async info({ pid }: ProducerModel.ProducerGet) {
    const redisKey = `Producerinfo:${pid}`
    const redisData = await getKv(redisKey)
    if (redisData !== null && redisData !== undefined) {
      return JSON.parse(redisData) as Producer
    }

    const [, error, producer] = t(
      await db
        .select({
          ...getTableColumns(producers),
          producers_relations:
            sql`(SELECT COALESCE(json_agg(row_to_json(t.*)), '[]'::json) FROM (SELECT pr.id, pr.pid, p.alias, p.name, pr.relation FROM producers_relations pr INNER JOIN producers p ON p.id = pr.pid WHERE pr.id = ${sql.identifier('producers')}.${sql.identifier('id')}) t)`,
        })
        .from(producers)
        .where(eq(producers.id, pid))
        .limit(1)
        .then((r) => r[0]),
    )

    if (!producer) throw status(404, `未找到 pid 为 ${pid} 的 producer`)

    if (error)
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)

    type Producer = typeof producer

    void setKv(redisKey, JSON.stringify(producer), 60 * 30)

    return producer
  },
  async gamelists({ pid }: ProducerModel.ProducerGet) {
    const redisKey = `ProducerGameLists:${pid}`
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
        .select({
          id: vn.id,
          alias: vn.alias,
          description: vn.description,
          olang: vn.olang,
          image_id: images.id,
          image_width: images.width,
          image_height: images.height,
          titles:
            sql`(SELECT COALESCE(json_agg(row_to_json(t.*)), '[]'::json) FROM (SELECT lang, official, title, latin FROM vn_titles WHERE id = ${vn.id}) t)`,
        })
        .from(vn)
        .innerJoin(images, eq(images.id, vn.cImage))
        .where(inArray(
          vn.id,
          db.select({ vid: releasesVn.vid })
            .from(releasesProducers)
            .innerJoin(releasesVn, eq(releasesVn.id, releasesProducers.id))
            .where(and(
              eq(releasesProducers.pid, pid),
              sql`EXISTS (SELECT 1 FROM galrc_alistb WHERE vid = ${releasesVn.vid})`,
            )),
        ) as any)
        .orderBy(vn.id),
    )

    type Producergamelists = typeof producerGamelists

    if (!producerGamelists) throw status(404, `未找到该生产者的游戏列表喵~`)

    if (error)
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)

    void setKv(redisKey, JSON.stringify(producerGamelists), 60 * 30)

    return producerGamelists
  },
}
