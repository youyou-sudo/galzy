import { db, vndbDb } from '@api/libs'
import { getKv, setKv } from '@api/libs/redis'
import { status } from 'elysia'
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres'
import { t } from 'try'
import type { TagsModel } from './model'

export const Tags = {
  async gameTags({ id }: TagsModel.gameTags) {
    const redisdata = await getKv(`gameTags-${id}`)
    if (redisdata !== null && redisdata !== undefined) {
      return JSON.parse(redisdata) as Tag
    }
    const idIsNumber = /^\d+$/.test(id)
    const [_, error, gameId] = t(
      await db
        .selectFrom('galrc_alistb')
        .where((eb) =>
          idIsNumber
            ? eb.or([eb('vid', '=', id), eb('other', '=', Number(id))])
            : eb('vid', '=', id),
        )
        .selectAll()
        .executeTakeFirst(),
    )
    if (!gameId) {
      throw status(404, '找不到数据喵~')
    }
    const tag = await vndbDb
      .selectFrom('tags_vn')
      .where('tags_vn.vid', '=', gameId.vid)
      .groupBy(['tags_vn.tag', 'tags_vn.vid'])
      .select((tagsVn) => [
        jsonObjectFrom(
          tagsVn
            .selectFrom('tags')
            .whereRef('tags.id', '=', 'tags_vn.tag')
            .select(['tags.id', 'tags.name', 'tags.description']),
        ).as('tag_data'),
      ])
      .execute()
    const items = tag.map((item) => item.tag_data)
    const tagIds = items
      .map((item) => item?.id)
      .filter((id): id is string => id !== undefined)

    const zhTag =
      tagIds.length > 0
        ? await db
          .selectFrom('galrc_zhtag')
          .where('galrc_zhtag.id', 'in', tagIds)
          .where('galrc_zhtag.exhibition', '=', true)
          .select([
            'galrc_zhtag.id',
            'galrc_zhtag.name as zh_name',
            'galrc_zhtag.alias as zh_alias',
            'galrc_zhtag.description as zh_description',
          ])
          .execute()
        : []
    const zhTagMap = new Map(zhTag.map((tag) => [tag.id, tag]))

    const tagMap = new Map(
      tag
        .map((t) => t.tag_data)
        .filter((data): data is NonNullable<typeof data> => data !== undefined)
        .map((data) => [data.id, data]),
    )

    const combinedArray = Array.from(tagMap.entries()).map(([id, tagData]) => {
      const zhTag = zhTagMap.get(id)
      return {
        id: tagData.id,
        name: tagData.name,
        description: tagData.description,
        zh_name: zhTag?.zh_name ?? null,
        zh_alias: zhTag?.zh_alias ?? null,
        zh_description: zhTag?.zh_description ?? null,
      }
    })

    const datas = {
      tag: combinedArray,
    }

    if (error) {
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    }
    void setKv(`gameTags-${id}`, JSON.stringify(datas), 60 * 60 * 1)
    type Tag = typeof datas
    return datas
  },
  async tag({ tagId }: TagsModel.tagId) {
    const redisdata = await getKv(`tag-${tagId}`)
    if (redisdata !== null && redisdata !== undefined) {
      return JSON.parse(redisdata) as Tag
    }
    const tag = await vndbDb
      .selectFrom('tags')
      .where('id', '=', tagId)
      .select(['id', 'name', 'description'])
      .executeTakeFirst()

    const zhtag = await db
      .selectFrom('galrc_zhtag')
      .where('id', '=', tagId)
      .select(['id', 'name as zht_name', 'description as zht_description'])
      .executeTakeFirst()

    const combined = {
      ...tag,
      ...zhtag,
    }
    void setKv(`tag-${tagId}`, JSON.stringify(combined), 60 * 60 * 1)
    type Tag = typeof combined
    return combined
  },
  async tagGames({ tagId, pageSize, pageIndex }: TagsModel.tagGames) {
    const redisdata = await getKv(`tagGames-${tagId}-${pageSize}-${pageIndex}`)
    if (redisdata !== null && redisdata !== undefined) {
      return JSON.parse(redisdata) as TagGames
    }
    const offset = pageIndex * pageSize
    // 1. 从 vndbDb 拿 tags_vn 和 vn 相关数据
    const tagsVnRows = await vndbDb
      .selectFrom('tags_vn')
      .where('tags_vn.tag', '=', tagId)
      .select(['tags_vn.vid'])
      .distinct()
      .limit(pageSize)
      .offset(offset)
      .execute()

    // 拿到 vid 列表
    const vids = tagsVnRows.map((row) => row.vid)

    // 2. 拿 vn、vn_titles、images
    const vnRows =
      vids.length > 0
        ? await vndbDb
          .selectFrom('vn')
          .where('vn.id', 'in', vids)
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
                .select(['height', 'id', 'width'])
                .whereRef('images.id', '=', 'vn.c_image'),
            ).as('images'),
          ])
          .execute()
        : []

    // 3. 从 db 拿 galrc_alistb + galrc_other 相关数据
    const alistRows =
      vids.length > 0
        ? await db
          .selectFrom('galrc_alistb')
          .where('galrc_alistb.vid', 'in', vids)
          .select((a) => [
            'galrc_alistb.vid',
            'galrc_alistb.other',
            jsonObjectFrom(
              a
                .selectFrom('galrc_other')
                .selectAll()
                .whereRef('galrc_other.id', '=', 'galrc_alistb.other')
                .select((o) => [
                  'galrc_alistb.other',
                  jsonArrayFrom(
                    o
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
          .execute()
        : []

    // 4. 在代码中合并
    const combined = alistRows.map((vid) => {
      const vnData = vnRows.find((v) => v.id === vid.vid)
      return {
        vid,
        ...vnData,
      }
    })
    const [, error1, totalCountResult] = t(
      await vndbDb
        .selectFrom('tags_vn')
        .groupBy(['tags_vn.tag', 'tags_vn.vid'])
        .select(({ fn }) => [fn.countAll().as('count')])
        .where('tags_vn.tag', '=', tagId)
        .executeTakeFirst(),
    )
    if (error1) {
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error1)}`)
    }
    const totalCount = Number(totalCountResult?.count || 0)
    const totalPages = Math.ceil(totalCount / pageSize)
    const data = {
      items: combined,
      currentPage: pageIndex,
      totalPages,
      totalCount,
    }
    void setKv(
      `tagGames-${tagId}-${pageSize}-${pageIndex}`,
      JSON.stringify(data),
      60 * 60 * 1,
    )
    type TagGames = typeof data
    return data
  },
  async tagAllGet({ pageSize, pageIndex, keyword, id }: TagsModel.tagAll) {
    const offset = pageIndex * pageSize
    let tagsQuery = vndbDb.selectFrom('tags').select(['id'])

    if (id) {
      tagsQuery = tagsQuery.where('id', 'like', `%${id}%`)
    }

    const tagsRows = await tagsQuery
      .orderBy('id', 'asc')
      .limit(pageSize)
      .offset(offset)
      .execute()

    // 拿到 tags 的 id 列表
    const tagIds = tagsRows.map((t) => t.id)

    // 2. 从 db 查询 galrc_zhtag
    let zhtagsQuery = db
      .selectFrom('galrc_zhtag')
      .where('id', 'in', tagIds)
      .select([
        'id',
        'name as zh_name',
        'description as zh_description',
        'alias as zh_alias',
        'exhibition',
      ])

    if (keyword) {
      zhtagsQuery = zhtagsQuery.where((eb) =>
        eb.or([
          eb('name', 'like', `%${keyword}%`),
          eb('alias', 'like', `%${keyword}%`),
          eb('description', 'like', `%${keyword}%`),
        ]),
      )
    }

    const zhtagsRows = await zhtagsQuery.execute()

    // 3. 合并结果
    const combined = tagsRows.map((tag) => {
      const zht = zhtagsRows.find((z) => z.id === tag.id)
      return {
        id: tag.id,
        ...zht,
      }
    })

    // 3. 查询总数
    const totalCountResult = await db
      .selectFrom('galrc_zhtag')
      .$if(!!keyword, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb('name', 'like', `%${keyword}%`),
            eb('alias', 'like', `%${keyword}%`),
            eb('description', 'like', `%${keyword}%`),
          ]),
        ),
      )
      .select(({ fn }) => [fn.countAll().as('count')])
      .executeTakeFirst()

    const totalCount = Number(totalCountResult?.count ?? 0)

    const totalPages = Math.ceil(totalCount / pageSize)

    return {
      items: combined,
      currentPage: pageIndex,
      totalPages,
      totalCount,
    }
  },
  async tagEdit({
    zh_name,
    exhibition,
    zh_alias,
    zh_description,
    id,
  }: TagsModel.tagEdit) {
    const [ok, error] = t(
      await db
        .updateTable('galrc_zhtag')
        .set({
          name: zh_name,
          exhibition,
          alias: zh_alias,
          description: zh_description,
        })
        .where('id', '=', id)
        .execute(),
    )
    if (error) {
      return false
    }
    if (ok) return true
  },
  async tagFileAdd({ file }: TagsModel.tagFileAdd) {
    const text = await file.text()
    const datas = JSON.parse(text)
    const datass = datas.map((item: any) => ({
      id: item.id,
      name: item.name,
      exhibition: item.exhibition,
      alias: item.alias,
      description: item.description,
    }))

    const [, error] = t(await
      db
        .insertInto('galrc_zhtag')
        .values(datass)
        .onConflict((oc) =>
          oc
            .column('id') // 假设 id 是主键，用于检测冲突
            .doUpdateSet({
              name: (eb) => eb.ref('excluded.name'),
              exhibition: (eb) => eb.ref('excluded.exhibition'),
              alias: (eb) => eb.ref('excluded.alias'),
              description: (eb) => eb.ref('excluded.description'),
            }),
        )
        .execute(),
    )

    if (error) {
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    }

    return true
  },
  async tagAllFileDwn() {
    const datas = await db.selectFrom('galrc_zhtag').selectAll().execute()
    return datas
  },
}
