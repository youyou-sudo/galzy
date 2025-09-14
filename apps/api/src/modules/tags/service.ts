import { db } from '@api/libs'
import { status } from 'elysia'
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres'
import { t } from 'try'
import type { TagsModel } from './model'
import { getKv, setKv } from '@api/libs/redis'

export const Tags = {
  async gameTags({ id }: TagsModel.gameTags) {
    const redisdata = await getKv(`gameTags-${id}`)
    if (redisdata !== null && redisdata !== undefined) {
      return JSON.parse(redisdata) as Tag
    }
    const idIsNumber = /^\d+$/.test(id)
    const [_, error, items] = t(
      await db
        .selectFrom('galrc_alistb')
        .innerJoin('vn', 'galrc_alistb.vid', 'vn.id')
        .where((eb) =>
          idIsNumber
            ? eb.or([eb('vid', '=', id), eb('other', '=', Number(id))])
            : eb('vid', '=', id),
        )
        .select((vneb) => [
          jsonArrayFrom(
            vneb
              .selectFrom('tags_vn')
              .whereRef('tags_vn.vid', '=', 'vn.id')
              .groupBy(['tags_vn.tag', 'tags_vn.vid'])
              .select((tagsVn) => [
                jsonObjectFrom(
                  tagsVn
                    .selectFrom('tags')
                    .innerJoin('galrc_zhtag', 'tags.id', 'galrc_zhtag.id')
                    .whereRef('tags.id', '=', 'tags_vn.tag')
                    .where('galrc_zhtag.exhibition', '=', true)
                    .select([
                      'tags.id',
                      'tags.name',
                      'tags.description',
                      'galrc_zhtag.name as zht_name',
                      'galrc_zhtag.description as zht_description',
                    ]),
                ).as('tag_data'),
              ]),
          ).as('tag'),
        ])
        .executeTakeFirst(),
    )
    if (error) {
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    }
    void setKv(`gameTags-${id}`, JSON.stringify(items), 60 * 60 * 1)
    type Tag = typeof items
    return items
  },
  async tag({ tagId }: TagsModel.tagId) {
    const redisdata = await getKv(`tag-${tagId}`)
    if (redisdata !== null && redisdata !== undefined) {
      return JSON.parse(redisdata) as Tag
    }
    const [, error, items] = t(
      await db
        .selectFrom('tags')
        .innerJoin('galrc_zhtag', 'tags.id', 'galrc_zhtag.id')
        .where('tags.id', '=', tagId)
        .select([
          'tags.id',
          'tags.name',
          'tags.description',
          'galrc_zhtag.name as zht_name',
          'galrc_zhtag.description as zht_description',
        ])
        .executeTakeFirst(),
    )
    if (error) {
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    }
    void setKv(`tag-${tagId}`, JSON.stringify(items), 60 * 60 * 1)
    type Tag = typeof items
    return items
  },
  async tagGames({ tagId, pageSize, pageIndex }: TagsModel.tagGames) {
    const redisdata = await getKv(`tagGames-${tagId}-${pageSize}-${pageIndex}`)
    if (redisdata !== null && redisdata !== undefined) {
      return JSON.parse(redisdata) as TagGames
    }
    const offset = pageIndex * pageSize
    const [, error, res] = t(
      await db
        .selectFrom('tags_vn')
        .innerJoin('galrc_alistb', 'galrc_alistb.vid', 'tags_vn.vid')
        .where('tags_vn.tag', '=', tagId)
        .groupBy(['tags_vn.tag', 'tags_vn.vid'])
        .select((tagsVn) => [
          jsonObjectFrom(
            tagsVn
              .selectFrom('galrc_alistb')
              .innerJoin('vn', 'galrc_alistb.vid', 'vn.id')
              .select(['vn.id', 'vn.olang'])
              .whereRef('galrc_alistb.vid', '=', 'tags_vn.vid')
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
                    .select(['height', 'id', 'width'])
                    .whereRef('images.id', '=', 'vn.c_image'),
                ).as('images'),
              ])
              .select((other) => [
                'galrc_alistb.other',
                jsonObjectFrom(
                  other
                    .selectFrom('galrc_other')
                    .whereRef('id', '=', 'galrc_alistb.other')
                    .selectAll()
                    .select((other) => [
                      'galrc_alistb.other',
                      jsonArrayFrom(
                        other
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
              ]),
          ).as('datas'),
        ])
        .orderBy('tags_vn.vid', 'desc')
        .limit(pageSize)
        .offset(offset)
        .execute(),
    )
    if (error) {
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    }
    const items = res.map((item) => ({
      ...item.datas,
    }))
    const [, error1, totalCountResult] = t(
      await db
        .selectFrom('tags_vn')
        .innerJoin('galrc_alistb', 'galrc_alistb.vid', 'tags_vn.vid')
        .groupBy(['tags_vn.tag', 'tags_vn.vid'])
        .select(({ fn }) => [fn.countAll().as('count')])
        .where('tags_vn.tag', '=', tagId)
        .executeTakeFirst(),
    )
    if (error1) {
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    }
    const totalCount = Number(totalCountResult?.count || 0)
    const totalPages = Math.ceil(totalCount / pageSize)
    const data = {
      items,
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
    // 1. 查询分页数据
    const [, error, data] = t(
      await db
        .selectFrom('tags')
        .innerJoin('galrc_zhtag', 'tags.id', 'galrc_zhtag.id')
        .select([
          'tags.id',
          'galrc_zhtag.name as zh_name',
          'galrc_zhtag.description as zh_description',
          'galrc_zhtag.alias as zh_alias',
          'galrc_zhtag.exhibition',
        ])
        // 模糊匹配 keyword
        .$if(!!keyword, (qb) =>
          qb.where((eb) =>
            eb.or([
              eb('galrc_zhtag.name', 'like', `%${keyword}%`),
              eb('galrc_zhtag.alias', 'like', `%${keyword}%`),
              eb('galrc_zhtag.description', 'like', `%${keyword}%`),
            ]),
          ),
        )
        // id 模糊匹配
        .$if(!!id, (qb) => qb.where('tags.id', 'like', `%${id}%`))
        .orderBy('tags.id', 'asc')
        .limit(pageSize)
        .offset(offset)
        .execute(),
    )
    if (error) {
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    }

    // 2. 查询总数
    const [, error1, totalCountResult] = t(
      await db
        .selectFrom('tags')
        .innerJoin('galrc_zhtag', 'tags.id', 'galrc_zhtag.id')
        .where('galrc_zhtag.exhibition', '=', true)
        .$if(!!keyword, (qb) =>
          qb.where((eb) =>
            eb.or([
              eb('galrc_zhtag.name', 'like', `%${keyword}%`),
              eb('galrc_zhtag.alias', 'like', `%${keyword}%`),
              eb('galrc_zhtag.description', 'like', `%${keyword}%`),
            ]),
          ),
        )
        .$if(!!id, (qb) => qb.where('tags.id', 'like', `%${id}%`))
        .select(({ fn }) => [fn.countAll().as('count')])
        .executeTakeFirst(),
    )
    if (error1) {
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error1)}`)
    }

    const totalCount = Number(totalCountResult?.count || 0)
    const totalPages = Math.ceil(totalCount / pageSize)

    return {
      items: data,
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
    const datass = datas.map((item: any) => {
      return {
        id: item.id,
        name: item.name,
        exhibition: true,
        alias: item.alias,
        description: item.description,
      }
    })
    const [, error] = t(
      await db
        .insertInto('galrc_zhtag')
        .values(datass)
        .onConflict((oc) => oc.doNothing())
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
  }
}
