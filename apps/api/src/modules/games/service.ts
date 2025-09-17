import { db, vndbDb } from '@api/libs'
import {
  acquireIdempotentKey,
  getIdempotentResult,
  getKv,
  setKv,
  storeIdempotentResult,
} from '@api/libs/redis'
import { status } from 'elysia'
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres'
import { t } from 'try'
import XXH from 'xxhashjs'
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
    void setKv('gameCount', String(count), 60 * 60 * 12)
    return count
  },
  async List({ pageIndex, pageSize }: GameModel.gameList) {
    const offset = pageIndex * pageSize
    try {
      const redisData = await getKv(`gameList-${pageIndex}-${pageSize}`)
      if (redisData !== null && redisData !== undefined) {
        return JSON.parse(redisData) as GameList
      }
      const [vidMapResult, totalCountResult] = await Promise.all([
        db
          .selectFrom('galrc_alistb')
          .selectAll()
          .orderBy('vid', 'desc')
          .limit(pageSize)
          .offset(offset)
          .execute(),
        db
          .selectFrom('galrc_alistb')
          .select(({ fn }) => [fn.countAll().as('count')])
          .executeTakeFirst(),
      ]);

      if (!totalCountResult) {
        throw new Error('Failed to fetch total count');
      }

      const vids = vidMapResult.map((row) => row.vid)
      const others = vidMapResult.map((row) => row.other)

      const [otherItems, vndbItems] = await Promise.all([
        others.length > 0
          ? db
            .selectFrom('galrc_other')
            .selectAll()
            .where('galrc_other.id', 'in', others)
            .select((eb) =>
              jsonArrayFrom(
                eb
                  .selectFrom('galrc_other_media')
                  .whereRef('other_id', '=', 'galrc_other.id')
                  .selectAll()
                  .select((media) =>
                    jsonObjectFrom(
                      media
                        .selectFrom('galrc_media')
                        .selectAll()
                        .whereRef('hash', '=', 'galrc_other_media.media_hash')
                    ).as('media')
                  )
              ).as('other_media')
            )
            .execute()
          : [],
        vids.length > 0
          ? vndbDb
            .selectFrom('vn')
            .where('vn.id', 'in', vids)
            .select((vneb) => [
              'vn.id',
              'vn.alias',
              'vn.description',
              'vn.olang',
              jsonArrayFrom(
                vneb
                  .selectFrom('vn_titles')
                  .selectAll()
                  .whereRef('id', '=', 'vn.id')
              ).as('titles'),
              jsonObjectFrom(
                vneb
                  .selectFrom('images')
                  .select(['height', 'id', 'width'])
                  .whereRef('id', '=', 'vn.c_image')
              ).as('images'),
            ])
            .orderBy('vn.id', 'desc')
            .execute()
          : [],
      ]);

      const otherMap = new Map(otherItems.map((item) => [item.id, item]));
      const vndbMap = new Map(vndbItems.map((item) => [item.id, item]));

      // Combine results
      const items = vidMapResult.map((row) => ({
        ...row,
        ...(row.vid ? vndbMap.get(row.vid) || {} : {}),
        other_datas: row.other ? otherMap.get(row.other) || null : null,
      }));
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
    } catch (error) {
      throw status(500, `服务出错了喵~,Error:${JSON.stringify(error)}`)
    }
  },
  async InfoGet({ id }: GameModel.infoId) {
    const redisData = await getKv(`gameInfo-${id}`)
    if (redisData !== null && redisData !== undefined) {
      return JSON.parse(redisData) as GameInfo
    }
    const idIsNumber = /^\d+$/.test(id)
    const idData = await db
      .selectFrom('galrc_alistb')
      .where((eb) =>
        idIsNumber
          ? eb('other', '=', Number(id))
          : eb('vid', '=', id),
      )
      .selectAll()
      .executeTakeFirst()
    if (!idData) {
      throw status(404, '找不到数据喵~')
    }

    const vndbItems = await vndbDb
      .selectFrom('vn')
      .where('vn.id', '=', idData.vid)
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
      ])
      .executeTakeFirst()

    const otherItems = await db
      .selectFrom('galrc_other')
      .where('galrc_other.id', '=', idData.other)
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
                  .whereRef(
                    'galrc_media.hash',
                    '=',
                    'galrc_other_media.media_hash',
                  ),
              ).as('media_datas'),
            ]),
        ).as('media'),
      ])
      .executeTakeFirst()

    const result = {
      ...idData,
      vn_datas: vndbItems,
      other_datas: otherItems,
    }

    void setKv(`gameInfo-${id}`, JSON.stringify(result), 60 * 60 * 12)
    type GameInfo = typeof result
    return result
  },
  async OpenListFiles({ id }: GameModel.OpenListFiles) {
    const redisData = await getKv(`gameOpenListFiles-${id}`)
    if (redisData != null) {
      return JSON.parse(redisData) as GameOpenListFiles
    }

    const isVNDB = /^v\d+$/.test(id)
    const targetKey = `${isVNDB ? 'vndb' : 'other'}-${id}`
    const keyPattern = `%[${targetKey}]%`

    // 从数据库查询
    const rows = await db
      .selectFrom('galrc_search_nodes')
      .selectAll()
      .where('parent', 'like', keyPattern)
      .execute()

    // 定义树节点构造类型
    type TreeNodeBuilder = Omit<GameModel.TreeNode, 'children'> & {
      children?: Record<string, TreeNodeBuilder>
    }

    const root: Record<string, TreeNodeBuilder> = {}

    // 构建树
    for (const row of rows) {
      const fullPath = `${row.parent.replace(/\/$/, '')}/${row.name}`
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
                size: row.size != null ? String(row.size) : undefined,
                format: part.includes('.')
                  ? part.substring(part.lastIndexOf('.') + 1).toUpperCase()
                  : undefined,
              }
              : {}),
          }
        }

        if (!isLast) {
          if (!currentLevel[part].children) {
            currentLevel[part].children = {}
          }
          currentLevel = currentLevel[part].children!
          parentId = nodeId
        }
      }
    }

    // 转换为最终类型
    function convert(node: Record<string, TreeNodeBuilder>): GameModel.TreeNode[] {
      return Object.values(node).map((n) => {
        const { children, ...rest } = n
        return {
          ...rest,
          ...(children ? { children: convert(children) } : {}),
        }
      })
    }

    // 查找子树
    function findMatchingSubtree(
      tree: Record<string, TreeNodeBuilder>,
      matchKey: string,
    ): GameModel.TreeNode[] {
      const result: GameModel.TreeNode[] = []

      for (const node of Object.values(tree)) {
        if (node.id.includes(matchKey)) {
          const { children, ...rest } = node
          result.push({
            ...rest,
            ...(children ? { children: convert(children) } : {}),
          })
        } else if (node.children) {
          const childMatch = findMatchingSubtree(node.children, matchKey)
          if (childMatch.length > 0) {
            result.push(...childMatch)
          }
        }
      }

      return result
    }

    const data = findMatchingSubtree(root, targetKey)

    // 缓存一小时
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

    const [, error, vidMap] = t(
      await whereQuery.limit(limit).offset(offset).selectAll().execute(),
    )
    const vids = vidMap.map((row) => row.vid)
    const others = vidMap.map((row) => row.other)
    const otherItems =
      others.length > 0
        ? await db
          .selectFrom('galrc_other')
          .where('galrc_other.id', 'in', others)
          .selectAll()
          .execute()
        : []
    const vndbItems =
      vids.length > 0
        ? await vndbDb
          .selectFrom('vn')
          .selectAll()
          .where('vn.id', 'in', vids)
          .execute()
        : []

    const otherMap = new Map(otherItems.map((item) => [item.id, item]))
    const vndbMap = new Map(vndbItems.map((item) => [item.id, item]))
    const result = vidMap.map((row) => {
      const vid = row.vid || null
      const other = row.other || null

      return {
        vid,
        other,
        vndatas: vid ? vndbMap.get(vid) || null : null,
        otherdatas: other ? otherMap.get(other) || null : null,
      }
    })
    if (error)
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    return {
      data: result,
      pagination: {
        total,
        limit,
        page,
        totalPages: Math.ceil(total / limit),
      },
    }
  },
  async VidassociationGet({ id }: GameModel.infoId) {
    const fetchData = async (otherId: number) => {
      return await db
        .selectFrom('galrc_other')
        .selectAll()
        .where('galrc_other.id', '=', otherId)
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
                    .whereRef('galrc_media.hash', '=', 'galrc_other_media.media_hash')
                ).as('mediadata'),
              ])
          ).as('othermedia'),
        ])
        .executeTakeFirst()
    }

    const isVid = id.startsWith('v')
    let otherId: number | null | undefined

    if (isVid) {
      const record = await db
        .selectFrom('galrc_alistb')
        .selectAll()
        .where('vid', '=', id)
        .executeTakeFirst()

      otherId = record?.other
    } else if (/^\d+$/.test(id)) {
      otherId = Number(id)
    } else {
      throw new Error(`Invalid id format: ${id}`)
    }

    if (!otherId) {
      const newOther = await db
        .insertInto('galrc_other')
        .values({ status: 'draft' })
        .returning('id')
        .executeTakeFirstOrThrow()

      otherId = newOther.id

      if (isVid) {
        await db
          .updateTable('galrc_alistb')
          .set({ other: otherId })
          .where('vid', '=', id)
          .execute()
      }
    }

    const data = await fetchData(otherId)
    return data
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
