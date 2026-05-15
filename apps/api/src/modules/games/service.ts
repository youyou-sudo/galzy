import { db, sql } from '@api/libs'
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
import { status } from 'elysia'
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres'
import { t } from 'try'
import type { GameModel } from './model'

export const Game = {
  async Count() {
    const redisData = await getKv('gameCount')
    if (redisData !== null && redisData !== undefined) {
      return Number(redisData)
    }
    const [, error, totalCountResult] = t(
      await db
        .selectFrom('galrc_alistb')
        .select(({ fn }) => [fn.countAll().as('count')])
        .executeTakeFirst(),
    )
    if (error)
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    const count = Number(totalCountResult?.count || 0)
    void setKv('gameCount', String(count), 60 * 30)
    return count
  },
  async List({ pageIndex, pageSize }: GameModel.gameList) {
    const redisData = await getKv(`gameList-${pageIndex}-${pageSize}`)
    if (redisData !== null && redisData !== undefined) {
      return JSON.parse(redisData) as GameList
    }
    const offset = pageIndex * pageSize
    const [, error, items] = await t(
      db
        .selectFrom('galrc_alistb')
        .innerJoin('vn', 'galrc_alistb.vid', 'vn.id')
        .select(['vn.id', 'vn.olang'])
        .select((v) => [
          'vn.id',
          'vn.olang',
          jsonArrayFrom(
            v
              .selectFrom('vn_titles')
              .selectAll()
              .whereRef('vn_titles.id', '=', 'vn.id'),
          ).as('titles'),
          jsonObjectFrom(
            v
              .selectFrom('images')
              .select(['id', 'height', 'width'])
              .whereRef('images.id', '=', 'vn.c_image'),
          ).as('images'),
        ])
        .select((o) => [
          'galrc_alistb.other',
          jsonObjectFrom(
            o
              .selectFrom('galrc_other')
              .whereRef('id', '=', 'galrc_alistb.other')
              .selectAll()
              .select((oc) => [
                'galrc_alistb.other',
                jsonArrayFrom(
                  oc
                    .selectFrom('galrc_other_media')
                    .selectAll()
                    .whereRef(
                      'galrc_other_media.other_id',
                      '=',
                      'galrc_other.id',
                    )
                    .select((om) => [
                      jsonObjectFrom(
                        om
                          .selectFrom('galrc_media')
                          .selectAll()
                          .whereRef(
                            'galrc_media.hash',
                            '=',
                            'galrc_other_media.media_hash',
                          ),
                      ).as('media'),
                    ]),
                ).as('other_media'),
              ]),
          ).as('other_datas'),
        ])
        .orderBy('vn.id', 'desc')
        .orderBy('galrc_alistb.other', 'desc')
        .limit(pageSize)
        .offset(offset)
        .execute(),
    )
    if (error) {
      throw status(500, `服务出错了喵~,Error:${JSON.stringify(error)}`)
    }
    const [, error1, totalCountResult] = t(
      await db
        .selectFrom('galrc_alistb')
        .select(({ fn }) => [fn.countAll().as('count')])
        .executeTakeFirst(),
    )
    if (error1) {
      throw status(500, `服务出错了喵~,Error:${JSON.stringify(error)}`)
    }
    const totalCount = Number(totalCountResult?.count || 0)
    const totalPages = Math.ceil(totalCount / pageSize)
    const datas = {
      items,
      currentPage: pageIndex,
      totalPages,
      totalCount,
    }
    void setKv(
      `gameList-${pageIndex}-${pageSize}`,
      JSON.stringify(datas),
      60 * 60 * 2,
    )
    type GameList = typeof datas
    return datas
  },
  async InfoGet({ id }: GameModel.infoId) {
    const cacheKey = `gameInfo-${id}`
    const redisData = await getKv(cacheKey)

    if (redisData) {
      try {
        return JSON.parse(redisData) as GameInfo
      } catch {
        await delKv(cacheKey)
      }
    }

    const idIsNumber = /^\d+$/.test(id)

    const [, error, data] = t(
      await db
        .selectFrom('galrc_alistb')
        .where((eb) =>
          idIsNumber ? eb('other', '=', Number(id)) : eb('vid', '=', id),
        )
        .selectAll()
        .select((eb) => [
          eb
            .selectFrom('releases_vn')
            .innerJoin('releases', 'releases.id', 'releases_vn.id')
            .whereRef('releases_vn.vid', '=', 'galrc_alistb.vid')
            .select('releases.released')
            .orderBy('releases.released', 'asc')
            .limit(1)
            .as('released_first'),
          jsonArrayFrom(
            eb
              .selectFrom('releases_vn')
              .innerJoin(
                'releases_producers',
                'releases_producers.id',
                'releases_vn.id',
              )
              .innerJoin('releases', 'releases.id', 'releases_vn.id')
              .innerJoin('producers', 'producers.id', 'releases_producers.pid')
              .whereRef('releases_vn.vid', '=', 'galrc_alistb.vid')
              .groupBy([
                'producers.id',
                'producers.name',
                'producers.latin',
                'producers.alias',
                'producers.type',
              ])
              .select((pb) => [
                'producers.id',
                'producers.name',
                'producers.latin',
                'producers.alias',
                'producers.type',

                pb.fn.countAll().as('count'),

                pb.fn
                  .agg<boolean>('bool_or', ['releases_producers.developer'])
                  .as('is_dev'),
                pb.fn
                  .agg<boolean>('bool_or', ['releases_producers.publisher'])
                  .as('is_pub'),

                pb.fn
                  .agg<boolean>('bool_or', ['releases.official'])
                  .as('official'),
                pb.fn.min<number>('releases.released').as('first_release'),
              ])

              .orderBy('official', 'desc') // NOT bool_or(official)
              .orderBy('first_release', 'asc'), // MIN(released)
          ).as('producers'),
          jsonObjectFrom(
            eb
              .selectFrom('vn')
              .whereRef('vn.id', '=', 'galrc_alistb.vid')
              .selectAll()
              .select((vneb) => [
                'vn.id',
                jsonArrayFrom(
                  vneb
                    .selectFrom('vn_titles')
                    .selectAll()
                    .whereRef('vn_titles.id', '=', 'vn.id'),
                ).as('titles'),
                jsonObjectFrom(
                  vneb
                    .selectFrom('images')
                    .select(['id', 'height', 'width'])
                    .whereRef('images.id', '=', 'vn.c_image'),
                ).as('images'),
              ]),
          ).as('vn_datas'),

          jsonObjectFrom(
            eb
              .selectFrom('galrc_other')
              .whereRef('galrc_other.id', '=', 'galrc_alistb.other')
              .selectAll()
              .select((other) => [
                'id',
                jsonArrayFrom(
                  other
                    .selectFrom('galrc_other_media')
                    .whereRef(
                      'galrc_other_media.other_id',
                      '=',
                      'galrc_other.id',
                    )
                    .select((media) => [
                      'galrc_other_media.cover',
                      jsonObjectFrom(
                        media
                          .selectFrom('galrc_media')
                          .selectAll()
                          .whereRef(
                            'galrc_media.hash',
                            '=',
                            'galrc_other_media.media_hash',
                          ),
                      ).as('media_datas'),
                    ]),
                ).as('media'),
              ]),
          ).as('other_datas'),
        ])
        .executeTakeFirst(),
    )

    if (error) {
      throw status(500, `服务出错了喵~ Error: ${JSON.stringify(error)}`)
    }

    if (!data) {
      throw status(404, `未找到 id=${id} 对应的游戏信息`)
    }

    const result = structuredClone(data)
    void setKv(cacheKey, JSON.stringify(result), 60 * 60 * 6)

    type GameInfo = typeof result
    return result
  },
  async OpenListFiles({
    id,
  }: GameModel.OpenListFiles): Promise<GameModel.TreeNode[]> {
    const cacheKey = `OpenListFiles-${id}`
    const redisData = await getKv(cacheKey)

    if (redisData) {
      try {
        return JSON.parse(redisData) as DataType
      } catch {
        await delKv(cacheKey)
      }
    }
    const viddata = await db
      .selectFrom('galrc_alistb')
      .where('vid', '=', id)
      .selectAll()
      .executeTakeFirst()

    type RawItem = {
      name: string
      size: number
      is_dir: boolean
      type: number
    }

    const fetchList = async (parent: string): Promise<RawItem[]> => {
      const res = await fetch(`${process.env.OPENLIST_HOST}/api/fs/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `${process.env.OPENLIST_API_KEY}`,
        },
        body: JSON.stringify({
          path: parent,
          password: '',
          refresh: false,
          page: 1,
          per_page: 100000,
        }),
      })

      const json = await res.json()
      return json.data?.content || []
    }

    // 简单 size 格式化
    const formatSize = (size: number) => {
      if (!size) return '0B'
      const units = ['B', 'KB', 'MB', 'GB']
      let i = 0
      while (size >= 1024 && i < units.length - 1) {
        size /= 1024
        i++
      }
      return `${size.toFixed(1)}${units[i]}`
    }

    const buildTree = async (parent: string): Promise<GameModel.TreeNode[]> => {
      const list = await fetchList(parent)

      const mdMap = new Map<string, string>()
      for (const item of list) {
        if (!item.is_dir && item.name.endsWith('.md')) {
          const base = item.name.replace(/\.md$/, '')
          mdMap.set(base, `${parent}/${item.name}`)
        }
      }

      // 先构建 node（不递归）
      const nodes: GameModel.TreeNode[] = list
        .filter((item) => !(!item.is_dir && item.name.endsWith('.md')))
        .map((item) => {
          const node: GameModel.TreeNode = {
            id: `${parent}/${item.name}`,
            name: item.name,
            type: item.is_dir ? 'folder' : 'file',
          }

          if (!item.is_dir) {
            node.size = formatSize(item.size)
            node.format = item.name.split('.').pop()
          }

          if (mdMap.has(item.name)) {
            node.redame = mdMap.get(item.name)
          }

          return node
        })

      // 👉 并行处理子目录
      await Promise.all(
        nodes.map(async (node) => {
          if (node.type === 'folder') {
            node.children = await buildTree(node.id)
          }
        }),
      )

      return nodes
    }

    const buildAllTrees = async (
      paths: string[],
    ): Promise<GameModel.TreeNode[]> => {
      return Promise.all(
        paths.map(async (p) => {
          const tree = await buildTree(p)

          return {
            id: p,
            name: p.split('/').pop() ?? '',
            type: 'folder' as const,
            children: tree,
          }
        }),
      )
    }
    if (!viddata?.path) throw status(500, `未找到相关文件`)

    const data = await buildAllTrees(viddata?.path)
    void setKv(cacheKey, JSON.stringify(data), 60 * 6)
    type DataType = typeof data
    return data
  },
  async DataFilteringStats() {
    const [, error, [onlyOther, bothExist, onlyVid, all]] = t(
      await Promise.all([
        db
          .selectFrom('galrc_alistb')
          .select(({ fn }) => [fn.countAll<number>().as('count')])
          .where('galrc_alistb.other', 'is not', null)
          .where('galrc_alistb.vid', 'is', null)
          .executeTakeFirst(),

        db
          .selectFrom('galrc_alistb')
          .select(({ fn }) => [fn.countAll<number>().as('count')])
          .where('galrc_alistb.vid', 'is not', null)
          .where('galrc_alistb.other', 'is not', null)
          .executeTakeFirst(),

        db
          .selectFrom('galrc_alistb')
          .select(({ fn }) => [fn.countAll<number>().as('count')])
          .where('galrc_alistb.vid', 'is not', null)
          .where('galrc_alistb.other', 'is', null)
          .executeTakeFirst(),

        db
          .selectFrom('galrc_alistb')
          .select(({ fn }) => [fn.countAll<number>().as('count')])
          .executeTakeFirst(),
      ]),
    )
    if (error)
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    const data = {
      onlyOther: onlyOther?.count ?? 0,
      bothExist: bothExist?.count ?? 0,
      onlyVid: onlyVid?.count ?? 0,
      all: all?.count ?? 0,
    }
    return data
  },
  async DataFiltering({
    vid,
    otherId,
    query,
    limit,
    page,
  }: GameModel.dataFiltering) {
    function extractNumber(vi: any) {
      const digits = vi.match(/\d+/g)
      if (!digits) {
        return null
      }
      return Number(digits.join(''))
    }

    const offset = (page - 1) * limit

    const baseQuery = db.selectFrom('galrc_alistb')

    // [ ] [延后] 数据管理界面标题和别名搜索

    let whereQuery = baseQuery
    if (otherId != null && (vid == null || vid === undefined)) {
      whereQuery = whereQuery
        .where('galrc_alistb.other', 'is not', null)
        .where('galrc_alistb.vid', 'is', null)
    } else if (vid != null && otherId != null) {
      whereQuery = whereQuery
        .where('galrc_alistb.vid', 'is not', null)
        .where('galrc_alistb.other', 'is not', null)
    } else if (vid != null && (otherId == null || otherId === undefined)) {
      whereQuery = whereQuery
        .where('galrc_alistb.vid', 'is not', null)
        .where('galrc_alistb.other', 'is', null)
    }

    const totalResult = await whereQuery
      .select(({ fn }) => [fn.countAll<number>().as('count')])
      .executeTakeFirst()

    const total = totalResult?.count ?? 0

    const numQuery = extractNumber(query)

    let dataQuery = whereQuery

    if (numQuery !== null && numQuery !== undefined) {
      dataQuery = dataQuery.where((eb) =>
        eb.or([
          eb('galrc_alistb.vid', 'like', query),
          eb('galrc_alistb.other', '=', numQuery),
        ]),
      )
    }

    dataQuery = dataQuery
      .select((qb) => [
        'galrc_alistb.id',
        'galrc_alistb.vid',
        'galrc_alistb.other',
        jsonObjectFrom(
          qb
            .selectFrom('vn')
            .selectAll()
            .whereRef('vn.id', '=', 'galrc_alistb.vid'),
        ).as('vndatas'),
        jsonObjectFrom(
          qb
            .selectFrom('galrc_other')
            .selectAll()
            .whereRef('galrc_other.id', '=', 'galrc_alistb.other'),
        ).as('otherdatas'),
      ])
      .limit(limit)
      .offset(offset)

    const [, error, data] = t(await dataQuery.execute())
    if (error)
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    return {
      data,
      pagination: {
        total,
        limit,
        page,
        totalPages: Math.ceil(total / limit),
      },
    }
  },
  async VidassociationGet({ id }: GameModel.infoId) {
    if (id.startsWith('v')) {
      const fetchData = async () => {
        return await db
          .selectFrom('galrc_alistb')
          .selectAll()
          .where('vid', '=', id)
          .select((eb) => [
            'galrc_alistb.other',
            jsonObjectFrom(
              eb
                .selectFrom('galrc_other')
                .selectAll()
                .whereRef('galrc_other.id', '=', 'galrc_alistb.other')
                .select((other) => [
                  'id',
                  jsonArrayFrom(
                    other
                      .selectFrom('galrc_other_media')
                      .whereRef(
                        'galrc_other_media.other_id',
                        '=',
                        'galrc_other.id',
                      )
                      .select((media) => [
                        'galrc_other_media.cover',
                        jsonObjectFrom(
                          media
                            .selectFrom('galrc_media')
                            .selectAll()
                            .whereRef(
                              'galrc_media.hash',
                              '=',
                              'galrc_other_media.media_hash',
                            ),
                        ).as('mediadata'),
                      ]),
                  ).as('othermedia'),
                ]),
            ).as('other_data'),
          ])
          .executeTakeFirst()
      }
      let [, error, data] = t(await fetchData())
      if (error)
        throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
      if (data?.other_data === null) {
        const [, error, newOtherId] = t(
          await db
            .insertInto('galrc_other')
            .values({ status: 'draft' })
            .returning('id')
            .executeTakeFirstOrThrow(),
        )
        if (error)
          throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
        const [, error1] = t(
          await db
            .updateTable('galrc_alistb')
            .set({ other: newOtherId.id })
            .where('vid', '=', id)
            .execute(),
        )
        if (error1)
          throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
        data = await fetchData()
      }
      const datas = data!.other_data
      return datas
    }
    if (id.match(/^\d+$/)) {
      const fetchData = async () => {
        return await db
          .selectFrom('galrc_other')
          .selectAll()
          .where('galrc_other.id', '=', Number(id))
          .select((other) => [
            'id',
            jsonArrayFrom(
              other
                .selectFrom('galrc_other_media')
                .whereRef('galrc_other_media.other_id', '=', 'galrc_other.id')
                .select((media) => [
                  'galrc_other_media.cover',
                  jsonObjectFrom(
                    media
                      .selectFrom('galrc_media')
                      .selectAll()
                      .whereRef(
                        'galrc_media.hash',
                        '=',
                        'galrc_other_media.media_hash',
                      ),
                  ).as('mediadata'),
                ])
                .whereRef('galrc_other_media.other_id', '=', 'galrc_other.id'),
            ).as('othermedia'),
          ])
          .executeTakeFirst()
      }
      let [, error, data] = t(await fetchData())
      if (error)
        throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
      if (data === undefined) {
        const [, error, newOtherId] = t(
          await db
            .insertInto('galrc_other')
            .values({ status: 'draft' })
            .returning('id')
            .executeTakeFirstOrThrow(),
        )
        if (error)
          throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)

        const [, error1] = t(
          await db
            .updateTable('galrc_alistb')
            .set({ other: newOtherId.id })
            .where('other', '=', Number(id))
            .execute(),
        )
        if (error1)
          throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)

        data = await fetchData()
      }
      return data
    }
  },
  async vidassociationUpdate({ id, data }: GameModel.vidassociationUpdate) {
    const hash = generateIdempotentHash({ id, data })
    const cached = await getIdempotentResult(`vidassociationUpdate-${hash}`)
    if (cached) {
      return cached
    }
    const ok = await acquireIdempotentKey(`vidassociationUpdate-${hash}`, 60)
    if (!ok) {
      throw status(200, '重复请求')
    }
    const { title, description, alias } = data
    const titleObject = Array.isArray(title) ? JSON.stringify(title) : title
    const [, error] = t(
      await db
        .updateTable('galrc_other')
        .where('id', '=', Number(id))
        .set({
          title: titleObject,
          description: description,
          alias: alias,
        })
        .executeTakeFirstOrThrow(),
    )
    let datas = {}
    if (error) {
      datas = {
        message: '更新 galrc_other 失败',
        status: 'error',
        error: error,
      }
    }
    datas = {
      message: '更新 galrc_other 成功',
      status: 'success',
    }
    await delKv(`gameInfo-${id}`)
    await delKv(`vidassociation-${id}`)
    await delKvPattern('gameList-*')
    await delKv('gameCount')
    await storeIdempotentResult(`vidassociationUpdate-${hash}`, datas, 60)
    return datas
  },
  async vidassociationCreate() {
    const cached = await getIdempotentResult(`vidassociationCreate:action`)
    if (cached) {
      return cached as OtherId
    }
    const ok = await acquireIdempotentKey(`vidassociationCreate:action`, 2)
    if (!ok) {
      throw status(200, '重复请求')
    }
    const otherId = await db.transaction().execute(async (trx) => {
      const newOther = await trx
        .insertInto('galrc_other')
        .values({ status: 'draft' })
        .returning('id')
        .executeTakeFirstOrThrow()

      await trx
        .insertInto('galrc_alistb')
        .values({
          id: String(newOther.id),
          other: newOther.id,
        })
        .execute()

      return newOther
    })

    await storeIdempotentResult(`vidassociationCreate:action`, otherId, 2)
    type OtherId = typeof otherId
    return otherId
  },
  async gameTimeNumberGet({ id, time }: GameModel.gameTimeNumberGet) {
    const mode =
      time === 'week' ? 'week' : time === 'month' ? 'month' : 'quarter'
    const res = await sql<any>`
  WITH series AS (
    SELECT generate_series(
      CASE
        WHEN ${mode} = 'week' THEN date_trunc('week', CURRENT_DATE) - interval '6 week'
        ELSE date_trunc('year', CURRENT_DATE)
      END,
      CASE
        WHEN ${mode} = 'week' THEN date_trunc('week', CURRENT_DATE)
        WHEN ${mode} = 'month' THEN date_trunc('year', CURRENT_DATE) + interval '11 month'
        ELSE date_trunc('year', CURRENT_DATE) + interval '9 month'
      END,
      CASE
        WHEN ${mode} = 'week' THEN interval '1 week'
        WHEN ${mode} = 'month' THEN interval '1 month'
        ELSE interval '3 month'
      END
    ) AS start
  )

  SELECT
    CASE
      WHEN ${mode} = 'week' THEN to_char(start, 'IW') || '周'
      WHEN ${mode} = 'month' THEN to_char(start, 'MM') || '月'
      ELSE '第' || extract(quarter from start) || '季度'
    END AS label,

    COUNT(d.id)::int AS total

  FROM series
  LEFT JOIN "galrc_gameDownloadStats" d
    ON date_trunc(${mode}, d.created_at) = start
    AND d.game_id = ${id}

  GROUP BY start
  ORDER BY start ASC;
`.execute(db)
    const [, error, data] = t(
      await db
        .selectFrom('galrc_gameDownloadStats')
        .select(db.fn.count<number>('game_id').as('total'))
        .where('game_id', '=', id)
        .executeTakeFirst(),
    )
    if (error)
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    return { total: data?.total, res }
  },
}
