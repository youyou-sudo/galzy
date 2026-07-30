import {
  alistb,
  db,
  images,
  media,
  otherMedia,
  others,
  tags,
  tagsVn,
  vn,
  vnTitles,
  zhtags,
} from '@api/libs'
import { purgeByTags, purgeTagPages } from '@api/libs/cloudflare-cache'
import { delKv, getKv, setKv } from '@api/libs/redis'
import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  like,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'
import { status } from 'elysia'
import type { TagsModel } from './model'

export const Tags = {
  async gameTags({ id }: TagsModel.gameTags) {
    const cacheKey = `galzy:game:tags:${id}`

    // 1. 尝试从缓存读取
    const redisData = await getKv(cacheKey)
    if (redisData) {
      try {
        return JSON.parse(redisData) as Tag
      } catch {
        // 缓存损坏 → 删除并继续查库
        await delKv(cacheKey)
      }
    }

    // 2. 判断 id 是否为数字
    const idIsNumber = /^\d+$/.test(id)

    // 3. 查询数据库
    const items = await db
      .select({
        tags: sql<Array<Record<string, any>>>`COALESCE(
          (SELECT json_agg(row_to_json(sub.*))
           FROM (
             SELECT
               (SELECT row_to_json(tag_obj.*)
                FROM (
                  SELECT t.id, t.name, t.description,
                         z.name AS zht_name, z.description AS zht_description
                  FROM ${tags} t
                  INNER JOIN ${zhtags} z ON t.id = z.id
                  WHERE t.id = tv.tag AND z.exhibition = TRUE
                ) tag_obj
               ) AS tag_data
             FROM ${tagsVn} tv
             WHERE tv.vid = ${vn.id} AND tv.vote > 0
             GROUP BY tv.tag, tv.vid
             HAVING AVG(tv.vote) > 1
           ) sub
          ), '[]'::json
        )`,
      })
      .from(alistb)
      .innerJoin(vn, eq(alistb.vid, vn.id))
      .where(
        idIsNumber
          ? or(eq(alistb.vid, id), eq(alistb.other, Number(id)))
          : eq(vn.id, id),
      )
      .limit(1)
      .then((r) => r[0])

    if (!items) {
      throw status(404, `没有找到数据: id=${id}`)
    }

    const result = structuredClone(items)

    // 写入缓存（失败时只记录，不影响结果返回）
    void setKv(cacheKey, JSON.stringify(result), 60 * 60)

    // 类型定义：保证 result 不会是 undefined
    type Tag = NonNullable<typeof result>
    return result
  },
  async tag({ tagId }: TagsModel.tagId) {
    const redisdata = await getKv(`galzy:tag:${tagId}`)
    if (redisdata !== null && redisdata !== undefined) {
      return JSON.parse(redisdata) as Tag
    }
    const items = await db
      .select({
        id: tags.id,
        name: tags.name,
        description: tags.description,
        zht_name: zhtags.name,
        zht_description: zhtags.description,
      })
      .from(tags)
      .innerJoin(zhtags, eq(tags.id, zhtags.id))
      .where(eq(tags.id, tagId))
      .limit(1)
      .then((r) => r[0])

    if (!items) {
      throw status(404, `Tag ${tagId} 不存在`)
    }

    const result = structuredClone(items)
    void setKv(`galzy:tag:${tagId}`, JSON.stringify(result), 60 * 60 * 1)
    type Tag = typeof result
    return result
  },
  async tagGames({ tagId, pageSize, pageIndex }: TagsModel.tagGames) {
    const cacheKey = `galzy:tag:games:${tagId}:${pageSize}:${pageIndex}`

    // 先查缓存
    const redisData = await getKv(cacheKey)
    if (redisData) {
      try {
        return JSON.parse(redisData) as TagGames
      } catch {
        // 缓存损坏则忽略，走数据库查询
      }
    }

    const offset = pageIndex * pageSize

    // 并行执行 主查询 + 统计查询
    const [mainResult, countResult] = await Promise.all([
      db
        .select({
          datas: sql<Record<string, any>>`(SELECT row_to_json(obj.*)
            FROM (
              SELECT vn.id, vn.olang,
                COALESCE(
                  (SELECT json_agg(row_to_json(vnt.*)) FROM ${vnTitles} vnt WHERE vnt.id = vn.id),
                  '[]'::json
                ) AS titles,
(SELECT row_to_json(img.*)
                  FROM (SELECT id, height, width, c_sexual_avg FROM ${images} img WHERE img.id = vn.c_image) img
                ) AS images,
                a2.other,
                (SELECT row_to_json(od.*)
                 FROM (
                   SELECT o.*, a2.other,
                     COALESCE(
                       (SELECT json_agg(row_to_json(om_sub.*))
                        FROM (
                          SELECT om.*,
                            (SELECT row_to_json(m.*) FROM ${media} m WHERE m.hash = om.media_hash) AS media
                          FROM ${otherMedia} om WHERE om.other_id = o.id
                        ) om_sub
                       ), '[]'::json
                     ) AS other_media
                   FROM ${others} o WHERE o.id = a2.other
                 ) od
                ) AS other_datas
              FROM ${alistb} a2
              INNER JOIN ${vn} ON a2.vid = vn.id
              WHERE a2.vid = ${tagsVn.vid}
            ) obj
          )`,
        })
        .from(tagsVn)
        .innerJoin(alistb, eq(alistb.vid, tagsVn.vid))
        .where(eq(tagsVn.tag, tagId))
        .groupBy(tagsVn.tag, tagsVn.vid)
        .orderBy(desc(tagsVn.vid))
        .limit(pageSize)
        .offset(offset),

      db
        .select({ count: countDistinct(tagsVn.vid) })
        .from(tagsVn)
        .innerJoin(alistb, eq(alistb.vid, tagsVn.vid))
        .where(eq(tagsVn.tag, tagId))
        .then((r) => r[0]),
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

    // 设置缓存（异步执行，不阻塞返回）
    void setKv(cacheKey, JSON.stringify(data), 60 * 60)

    type TagGames = typeof data
    return data
  },
  async tagAllGet({ pageSize, pageIndex, keyword, id }: TagsModel.tagAll) {
    const offset = pageIndex * pageSize

    // 构建 keyword 与 id 的组合条件，用于两个查询复用
    const keywordConditions: SQL[] = []
    if (keyword) {
      // or() with 3 valid conditions never returns undefined
      keywordConditions.push(
        or(
          like(zhtags.name, `%${keyword}%`),
          like(zhtags.alias, `%${keyword}%`),
          like(zhtags.description, `%${keyword}%`),
        )!,
      )
    }
    if (id) {
      keywordConditions.push(like(tags.id, `%${id}%`))
    }
    const combinedFilter: SQL | undefined =
      keywordConditions.length > 0
        ? keywordConditions.length === 1
          ? keywordConditions[0]
          : and(...keywordConditions)
        : undefined

    // 1. 查询分页数据（单次 .where() 调用）
    const dataQuery = db
      .select({
        id: tags.id,
        zh_name: zhtags.name,
        zh_description: zhtags.description,
        zh_alias: zhtags.alias,
        exhibition: zhtags.exhibition,
      })
      .from(tags)
      .innerJoin(zhtags, eq(tags.id, zhtags.id))

    const data = await (combinedFilter
      ? dataQuery.where(combinedFilter)
      : dataQuery
    )
      .orderBy(asc(tags.id))
      .limit(pageSize)
      .offset(offset)

    // 2. 查询总数（与 data 查询使用相同过滤条件）
    const countQuery = db
      .select({ count: count() })
      .from(tags)
      .innerJoin(zhtags, eq(tags.id, zhtags.id))

    const totalCountResult = await (combinedFilter
      ? countQuery.where(combinedFilter)
      : countQuery
    ).then((r) => r[0])

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
    try {
      await db
        .update(zhtags)
        .set({
          name: zh_name,
          exhibition,
          alias: zh_alias,
          description: zh_description,
        })
        .where(eq(zhtags.id, id))
      await purgeTagPages(String(id))
      return true
    } catch {
      return false
    }
  },

  async tagFileAdd({ file }: TagsModel.tagFileAdd) {
    const text = await file.text()
    const datas = JSON.parse(text)
    const datass = datas.map(
      (item: {
        id: number
        name: string
        exhibition: boolean
        alias: string
        description: string
      }) => ({
        id: item.id,
        name: item.name,
        exhibition: item.exhibition,
        alias: item.alias,
        description: item.description,
      }),
    )

    await db
      .insert(zhtags)
      .values(datass)
      .onConflictDoUpdate({
        target: zhtags.id,
        set: {
          name: zhtags.name,
          exhibition: zhtags.exhibition,
          alias: zhtags.alias,
          description: zhtags.description,
        },
      })

    // Batch import: purge tag list (individual pages too many)
    await purgeByTags(['page-tags'])

    return true
  },
  async tagAllFileDwn() {
    const datas = await db
      .select({
        id: zhtags.id,
        name: zhtags.name,
        exhibition: zhtags.exhibition,
        alias: zhtags.alias,
        description: zhtags.description,
      })
      .from(zhtags)
    return datas
  },
}
