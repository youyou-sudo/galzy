import { db } from '@api/libs'
import XXH from 'xxhashjs'
import { status } from 'elysia'
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres'
import { t } from 'try'

import type { GameModel } from './model'
import {
  acquireIdempotentKey,
  delKv,
  getIdempotentResult,
  getKv,
  setKv,
  storeIdempotentResult,
} from '@api/libs/redis'

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
    void setKv('gameCount', String(count), 60 * 60 * 12)
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
      60 * 60 * 12,
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
          idIsNumber
            ? eb('other', '=', Number(id))
            : eb('vid', '=', id),
        )
        .selectAll()
        .select((eb) => [
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
                    .whereRef('galrc_other_media.other_id', '=', 'galrc_other.id')
                    .select((media) => [
                      'galrc_other_media.cover',
                      jsonObjectFrom(
                        media
                          .selectFrom('galrc_media')
                          .selectAll()
                          .whereRef('galrc_media.hash', '=', 'galrc_other_media.media_hash'),
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

    void setKv(cacheKey, JSON.stringify(data), 60 * 60 * 12)

    type GameInfo = typeof data
    return data as GameInfo
  },
  async OpenListFiles({ id }: GameModel.OpenListFiles) {
    const redisData = await getKv(`gameOpenListFiles-${id}`)
    if (redisData !== null && redisData !== undefined) {
      return JSON.parse(redisData) as GameOpenListFiles
    }
    const isVNDB = /^v\d+$/.test(id)
    const targetKey = `${isVNDB ? 'vndb' : 'other'}-${id}`
    const keyPattern = `%[${targetKey}]%`

    const [, rowsError, rows] = t(
      await db
        .selectFrom('galrc_search_nodes')
        .selectAll()
        .where('parent', 'like', keyPattern)
        .execute(),
    )
    if (rowsError)
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(rowsError)}`)

    type TreeNodeBuilder = Omit<GameModel.TreeNode, 'children'> & {
      children?: Record<string, TreeNodeBuilder>
    }
    const root: Record<string, TreeNodeBuilder> = {}

    for (const row of rows) {
      const fullPath = row.parent.endsWith('/')
        ? row.parent + row.name
        : `${row.parent}/${row.name}`
      const parts = fullPath.split('/').filter(Boolean)
      let currentLevel = root
      let parentId = ''

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        const isLast = i === parts.length - 1
        const nodeId = parentId ? `${parentId}/${part}` : part

        if (!currentLevel[part]) {
          currentLevel[part] = {
            id: nodeId,
            name: part.replace(/\[(vndb|other)-[^\]]+\]/g, '').trim(),
            type: isLast && !row.is_dir ? 'file' : 'folder',
            ...(isLast && !row.is_dir
              ? {
                size: row.size !== undefined ? String(row.size) : undefined,
                format: part.includes('.')
                  ? part.substring(part.lastIndexOf('.') + 1).toUpperCase()
                  : undefined,
              }
              : {}),
          }
        }

        if (!currentLevel[part].children && (!isLast || row.is_dir)) {
          currentLevel[part].children = {}
        }
        if (!isLast) {
          if (!currentLevel[part].children) return
          currentLevel = currentLevel[part].children
          parentId = nodeId
        }
      }
    }

    async function convert(
      node: Record<string, TreeNodeBuilder>,
    ): Promise<GameModel.TreeNode[]> {
      const nodes = await Promise.all(
        Object.values(node).map(async (n) => {
          const { children, ...rest } = n
          const base: GameModel.TreeNode = {
            ...rest,
            ...(children
              ? {
                children: await convert(
                  children as Record<string, TreeNodeBuilder>,
                ),
              }
              : {}),
          }

          return base
        }),
      )
      return nodes
    }

    const findMatchingSubtree = async (
      tree: Record<string, TreeNodeBuilder>,
      matchKey: string,
    ): Promise<GameModel.TreeNode[]> => {
      const result: GameModel.TreeNode[] = []

      for (const node of Object.values(tree)) {
        if (node.id.includes(matchKey)) {
          const { children, ...rest } = node
          result.push({
            ...rest,
            ...(children ? { children: await convert(children) } : {}),
          })
        } else if (node.children) {
          const childMatch = await findMatchingSubtree(node.children, matchKey)
          if (childMatch.length > 0) {
            result.push(...childMatch)
          }
        }
      }

      return result
    }
    const data = await findMatchingSubtree(root, targetKey)
    void setKv(`gameOpenListFiles-${id}`, JSON.stringify(data), 60 * 60)
    type GameOpenListFiles = typeof data
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
    const str = JSON.stringify({ id, data })
    const hash = XXH.h32(str, 0xabcd).toString(16)
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
    const otherId = await db
      .insertInto('galrc_other')
      .values({ status: 'draft' })
      .returning('id')
      .executeTakeFirstOrThrow()

    await db
      .insertInto('galrc_alistb')
      .values({
        id: String(otherId.id),
        other: otherId.id,
      })
      .execute()

    await storeIdempotentResult(`vidassociationCreate:action`, otherId, 2)
    type OtherId = typeof otherId
    return otherId
  },
}
