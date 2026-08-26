import {
  alistb,
  buildCoverUrl,
  db,
  hasUsablePortraitCover,
  images,
  kungalWorks,
  media,
  otherMedia,
  others,
  tags,
  tagsVn,
  transformStoredUrl,
  vn,
  vnTitles,
  zhtags,
} from '@api/libs'
import { purgeByTags, purgeTagPages } from '@api/libs/cloudflare-cache'
import { delKv, delKvPattern, getKv, setKv } from '@api/libs/redis'
import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  inArray,
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
          (SELECT json_agg(
            json_build_object(
              'tag_data', CASE WHEN z.id IS NOT NULL THEN
                json_build_object(
                  'id', t.id,
                  'name', t.name,
                  'description', t.description,
                  'zht_name', z.name,
                  'zht_description', z.description
                )
              ELSE NULL END
            )
          )
          FROM (
            SELECT tv.tag, AVG(tv.vote) AS avg_vote
            FROM ${tagsVn} tv
            WHERE tv.vid = ${vn.id} AND tv.vote > 0
            GROUP BY tv.tag
            HAVING AVG(tv.vote) > 1
          ) sub
          INNER JOIN ${tags} t ON t.id = sub.tag
          LEFT JOIN ${zhtags} z ON z.id = t.id AND z.exhibition = TRUE
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

    const offset = pageIndex * pageSize

    // 并行执行 主查询 + 统计查询
    const [mainResult, countResult] = await Promise.all([
      db
        .select({
          id: vn.id,
          olang: vn.olang,
          titles: sql<
            Array<{
              lang: string | null
              official: boolean | null
              title: string | null
              latin: string | null
            }>
          >`COALESCE(
            (SELECT json_agg(row_to_json(vnt.*)) FROM ${vnTitles} vnt WHERE vnt.id = ${vn.id}),
            '[]'::json
          )`,
          images: sql<{
            id: string
            height: number | null
            width: number | null
            c_sexual_avg: number | null
            url: string | null
            thumbhash?: string | null
            imageUrl?: string | null
          } | null>`(SELECT row_to_json(img.*)
            FROM (SELECT id, height, width, c_sexual_avg, url FROM ${images} img WHERE img.id = ${vn.cImage}) img
          )`,
          other: alistb.other,
          other_datas: sql`(SELECT row_to_json(od.*)
            FROM (
              SELECT o.*, ${alistb.other} AS other,
                COALESCE(
                  (SELECT json_agg(row_to_json(om_sub.*))
                   FROM (
                     SELECT om.*,
                       (SELECT row_to_json(m.*) FROM ${media} m WHERE m.hash = om.media_hash) AS media
                     FROM ${otherMedia} om WHERE om.other_id = o.id
                   ) om_sub
                  ), '[]'::json
                ) AS other_media
              FROM ${others} o WHERE o.id = ${alistb.other}
            ) od
          )`,
        })
        .from(tagsVn)
        .innerJoin(alistb, eq(alistb.vid, tagsVn.vid))
        .innerJoin(vn, eq(vn.id, alistb.vid))
        .where(eq(tagsVn.tag, tagId))
        .groupBy(
          tagsVn.tag,
          tagsVn.vid,
          vn.id,
          vn.olang,
          vn.cImage,
          alistb.other,
        )
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

    const items = mainResult

    const totalCount = Number(countResult?.count ?? 0)

    const kungalRows =
      items.length > 0
        ? await db
            .select({
              vndbId: kungalWorks.vndbId,
              coverUrl: kungalWorks.coverUrl,
              coverWidth: kungalWorks.coverWidth,
              coverHeight: kungalWorks.coverHeight,
              coverThumbhash: kungalWorks.coverThumbhash,
            })
            .from(kungalWorks)
            .where(
              inArray(
                kungalWorks.vndbId,
                items.map((item) => item.id),
              ),
            )
        : []
    const kungalMap = new Map(kungalRows.map((row) => [row.vndbId, row]))

    // Transform image URLs: replace VNDB host with configured CDN
    for (const item of items) {
      const img = item.images as Record<string, unknown> | null
      const kungal = kungalMap.get(item.id)
      if (
        hasUsablePortraitCover({
          url: kungal?.coverUrl,
          width: kungal?.coverWidth,
          height: kungal?.coverHeight,
        })
      ) {
        ;(item as any).images = {
          ...(img ?? { c_sexual_avg: 0 }),
          id: null,
          url: kungal?.coverUrl,
          imageUrl: kungal?.coverUrl,
          width: kungal?.coverWidth,
          height: kungal?.coverHeight,
          thumbhash: kungal?.coverThumbhash,
        }
      } else if (img) {
        img.imageUrl = img.id
          ? buildCoverUrl(
              img.id as string,
              img.width as number,
              img.height as number,
            )
          : null
        if (img.url) {
          img.url = transformStoredUrl(img.url as string)
        }
      }
    }
    const totalPages = Math.ceil(totalCount / pageSize)

    const data = {
      items,
      currentPage: pageIndex,
      totalPages,
      totalCount,
    }

    void setKv(cacheKey, JSON.stringify(data), 60 * 60)

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
  async tagCategories(): Promise<
    Record<
      string,
      Array<{ id: string; name: string; vnCount: number; views: number }>
    >
  > {
    const cacheKey = 'galzy:tags:categories:v4'
    const cached = await getKv(cacheKey)
    if (cached) {
      try {
        return JSON.parse(cached)
      } catch {
        await delKv(cacheKey)
      }
    }

    // 与详情页口径一致：仅展示已本地化（zhtags 存在）的标签，避免点进去 404
    // vnCount = 站内收录（alistb 存在）的关联游戏数，与标签详情页列表口径一致
    // views = 累计 tag_view 浏览量（供排序）
    const [rows, countRows, viewRows] = await Promise.all([
      db
        .select({
          id: tags.id,
          cat: tags.cat,
          name: zhtags.name,
        })
        .from(tags)
        .innerJoin(zhtags, eq(zhtags.id, tags.id)),
      db.execute(
        sql`SELECT tv.tag, count(DISTINCT tv.vid)::int AS cnt FROM tags_vn tv INNER JOIN galrc_alistb a ON a.vid = tv.vid GROUP BY tv.tag`,
      ),
      db.execute(
        sql`SELECT target_id, count(*)::int AS cnt FROM galrc_event_views WHERE event_type = 'tag_view' GROUP BY target_id`,
      ),
    ])

    const countMap = new Map(
      (countRows as Array<{ tag: string; cnt: number }>).map((r) => [
        r.tag,
        r.cnt,
      ]),
    )
    const viewMap = new Map(
      (viewRows as Array<{ target_id: string; cnt: number }>).map((r) => [
        r.target_id,
        r.cnt,
      ]),
    )

    const grouped: Record<
      string,
      Array<{ id: string; name: string; vnCount: number; views: number }>
    > = {
      cont: [],
      ero: [],
      tech: [],
    }
    for (const r of rows) {
      const list = grouped[r.cat ?? ''] ?? grouped.cont
      list.push({
        id: r.id,
        name: r.name || r.id,
        vnCount: countMap.get(r.id) ?? 0,
        views: viewMap.get(r.id) ?? 0,
      })
    }
    for (const list of Object.values(grouped)) {
      list.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
    }

    void setKv(cacheKey, JSON.stringify(grouped), 60 * 60)
    return grouped
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
      // 标签详情 / 游戏标签 / 分类页缓存同步失效（含本地化名称、展示状态）
      await delKv(`galzy:tag:${id}`)
      await delKvPattern('galzy:game:tags:*')
      await delKv('galzy:tags:categories:v4')
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
    // 批量导入影响所有标签缓存
    await delKvPattern('galzy:tag:*')
    await delKvPattern('galzy:game:tags:*')
    await delKv('galzy:tags:categories:v4')

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
