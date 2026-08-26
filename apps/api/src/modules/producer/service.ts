import {
  alistb,
  buildCoverUrl,
  db,
  hasUsablePortraitCover,
  images,
  kungalWorks,
  producers,
  releasesProducers,
  releasesVn,
  vn,
} from '@api/libs'
import { getKv, setKv } from '@api/libs/redis'
import {
  count,
  eq,
  getTableColumns,
  ilike,
  inArray,
  or,
  sql,
} from 'drizzle-orm'
import { status } from 'elysia'
import type { ProducerModel } from './model'

export const Producer = {
  async info({ pid }: ProducerModel.ProducerGet) {
    const redisKey = `galzy:producer:info:${pid}`
    const redisData = await getKv(redisKey)
    if (redisData !== null && redisData !== undefined) {
      return JSON.parse(redisData) as Producer
    }

    const producer = await db
      .select({
        ...getTableColumns(producers),
        producers_relations: sql`(SELECT COALESCE(json_agg(row_to_json(t.*)), '[]'::json) FROM (SELECT pr.id, pr.pid, p.alias, p.name, pr.relation FROM producers_relations pr INNER JOIN producers p ON p.id = pr.pid WHERE pr.id = ${sql.identifier('producers')}.${sql.identifier('id')}) t)`,
      })
      .from(producers)
      .where(eq(producers.id, pid))
      .limit(1)
      .then((r) => r[0])

    if (!producer) throw status(404, `未找到 pid 为 ${pid} 的 producer`)

    type Producer = typeof producer

    void setKv(redisKey, JSON.stringify(producer), 60 * 30)

    return producer
  },
  async gamelists({ pid, page = 1, limit = 50 }: ProducerModel.ProducerGet) {
    const cacheKey = `galzy:producer:gamelist:${pid}:${page}:${limit}`

    const offset = (page - 1) * limit

    const [producerGamelists, countResult] = await Promise.all([
      db
        .select({
          id: vn.id,
          alias: vn.alias,
          description: vn.description,
          olang: vn.olang,
          image_id: images.id,
          image_width: images.width,
          image_height: images.height,
          image_url: images.url,
          c_sexual_avg: images.cSexualAvg,
          titles: sql<
            Array<{
              lang: string | null
              official: boolean | null
              title: string | null
              latin: string | null
            }>
          >`(SELECT COALESCE(json_agg(row_to_json(t.*)), '[]'::json) FROM (SELECT lang, official, title, latin FROM vn_titles WHERE id = ${vn.id}) t)`,
        })
        .from(vn)
        .leftJoin(images, eq(images.id, vn.cImage))
        .where(
          inArray(
            vn.id,
            db
              .select({ vid: releasesVn.vid })
              .from(releasesProducers)
              .innerJoin(releasesVn, eq(releasesVn.id, releasesProducers.id))
              .innerJoin(alistb, eq(alistb.vid, releasesVn.vid))
              .where(eq(releasesProducers.pid, pid)),
          ) as any,
        )
        .orderBy(vn.id)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(releasesProducers)
        .innerJoin(releasesVn, eq(releasesVn.id, releasesProducers.id))
        .innerJoin(alistb, eq(alistb.vid, releasesVn.vid))
        .where(eq(releasesProducers.pid, pid))
        .then((r) => r[0]),
    ])

    const totalCount = Number(countResult?.count ?? 0)
    const kungalRows =
      producerGamelists.length > 0
        ? await db
            .select({
              vndbId: kungalWorks.vndbId,
              coverUrl: kungalWorks.coverUrl,
              coverWidth: kungalWorks.coverWidth,
              coverHeight: kungalWorks.coverHeight,
            })
            .from(kungalWorks)
            .where(
              inArray(
                kungalWorks.vndbId,
                producerGamelists.map((item) => item.id),
              ),
            )
        : []
    const kungalMap = new Map(kungalRows.map((row) => [row.vndbId, row]))
    for (const item of producerGamelists) {
      const kungal = kungalMap.get(item.id)
      if (
        hasUsablePortraitCover({
          url: kungal?.coverUrl,
          width: kungal?.coverWidth,
          height: kungal?.coverHeight,
        })
      ) {
        item.image_id = null
        item.image_url = kungal?.coverUrl ?? null
        item.image_width = kungal?.coverWidth ?? null
        item.image_height = kungal?.coverHeight ?? null
      } else {
        item.image_url = item.image_id
          ? buildCoverUrl(item.image_id, item.image_width, item.image_height)
          : null
      }
    }
    const data = {
      items: producerGamelists,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    }

    if (!producerGamelists.length && totalCount === 0)
      throw status(404, `未找到该生产者的游戏列表喵~`)

    void setKv(cacheKey, JSON.stringify(data), 60 * 30)

    return data
  },
  async search({ q, limit = 20 }: ProducerModel.search) {
    const cacheKey = `galzy:producer:search:${q}:${limit}`
    const cached = await getKv(cacheKey)
    if (cached)
      return JSON.parse(cached) as Array<{
        id: string
        name: string | null
        latin: string | null
      }>

    const results = await db
      .select({
        id: producers.id,
        name: producers.name,
        latin: producers.latin,
      })
      .from(producers)
      .where(
        or(
          ilike(producers.name, `%${q}%`),
          ilike(producers.latin, `%${q}%`),
          eq(producers.id, q),
        ),
      )
      .limit(limit)
      .orderBy(producers.name)

    void setKv(cacheKey, JSON.stringify(results), 60)
    return results
  },
}
