import { db } from '@api/libs'
import { status } from 'elysia'
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres'
import { t } from 'try'
import type { TagsModel } from './model'

export const Tags = {
  async gameTags({ id }: TagsModel.gameTags) {

    const idIsNumber = /^\d+$/.test(id)

    const [, error, items] = await t(
      db
        .selectFrom('galrc_alistb')
        .innerJoin('vn', 'galrc_alistb.vid', 'vn.id')
        .where((eb) =>
          idIsNumber
            ? eb.or([
                eb('galrc_alistb.vid', '=', id),
                eb('galrc_alistb.other', '=', Number(id)),
              ])
            : eb('vn.id', '=', id),
        )
        .select((vneb) => [
          jsonArrayFrom(
            vneb
              .selectFrom('tags_vn')
              .whereRef('tags_vn.vid', '=', 'vn.id')
              // 只考虑有正向投票的数据
              .where('tags_vn.vote', '>', 0)
              // 分组统计标签的平均分
              .groupBy(['tags_vn.tag', 'tags_vn.vid'])
              .having((eb) => eb.fn.avg('tags_vn.vote'), '>', 1)
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
          ).as('tags'),
        ])
        .executeTakeFirst(),
    )

    if (error) {
      throw status(500, `服务出错了喵~ Error:${JSON.stringify(error)}`)
    }

    if (!items) {
      throw status(404, `没有找到数据: id=${id}`)
    }

    const result = structuredClone(items)

    return result
  },
  async tag({ tagId }: TagsModel.tagId) {
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

    if (!items) {
      throw status(404, `Tag ${tagId} 不存在`)
    }

    const result = structuredClone(items)
    if (error) {
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    }
    return result
  },
  async tagGames({ tagId, pageSize, pageIndex }: TagsModel.tagGames) {
    const offset = pageIndex * pageSize

    const [mainResult, countResult] = await Promise.all([
      db
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

      db
        .selectFrom('tags_vn')
        .innerJoin('galrc_alistb', 'galrc_alistb.vid', 'tags_vn.vid')
        .where('tags_vn.tag', '=', tagId)
        .select(({ fn }) => [fn.count('tags_vn.vid').distinct().as('count')])
        .executeTakeFirst(),
    ])

    // main query 结果处理
    const items = mainResult.map((item) => item.datas)

    // count query 结果处理
    const totalCount = Number(countResult?.count ?? 0)
    const totalPages = Math.ceil(totalCount / pageSize)

    const data = {
      items,
      currentPage: pageIndex,
      totalPages,
      totalCount,
    }

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
    const datass = datas.map((item: any) => ({
      id: item.id,
      name: item.name,
      exhibition: item.exhibition,
      alias: item.alias,
      description: item.description,
    }))

    const [, error] = await t(
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
