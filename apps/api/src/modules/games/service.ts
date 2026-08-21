import {
  alistb,
  buildCoverUrl,
  db,
  eventViews,
  gameDownloadStats,
  kungalWorks,
  kungalWorkTitles,
  listCloudreveFiles,
  MeiliClient,
  others,
  pathToCloudreveUri,
  producers,
  releases,
  releasesProducers,
  releasesVn,
  sql,
  transformStoredUrl,
  vn,
  vnTitles,
} from '@api/libs'
import { purgeGamePages } from '@api/libs/cloudflare-cache'
import {
  acquireIdempotentKey,
  acquireLockKv,
  delKv,
  delKvPattern,
  generateIdempotentHash,
  getIdempotentResult,
  getKv,
  releaseLockKv,
  setKv,
  storeIdempotentResult,
} from '@api/libs/redis'

import {
  and,
  asc,
  count as countAll,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  like,
  min,
  or,
} from 'drizzle-orm'
import { status } from 'elysia'
import type { GameModel } from './model'

export const Game = {
  async Count() {
    const redisData = await getKv('galzy:game:count')
    if (redisData !== null && redisData !== undefined) {
      return Number(redisData)
    }
    const totalCountResult = await db
      .select({ count: countAll() })
      .from(alistb)
      .innerJoin(vn, eq(alistb.vid, vn.id))
      .then((r) => r[0])
    const total = Number(totalCountResult?.count || 0)
    void setKv('galzy:game:count', String(total), 60 * 30)
    return total
  },
  async List({ pageIndex, pageSize, sortBy, order }: GameModel.gameList) {
    const useCache = !sortBy || sortBy === 'id'
    const cacheKey = `galzy:game:list:${pageIndex}:${pageSize}${useCache ? '' : `:${sortBy}:${order}`}`
    const offset = pageIndex * pageSize
    const dir = order === 'asc' ? 'ASC' : 'DESC'
    let orderClause
    if (sortBy === 'released') {
      orderClause = sql.raw(
        `COALESCE((SELECT kw.released_first FROM galrc_kungal_works kw WHERE kw.vndb_id = vn.id), (SELECT MIN(r.released) FROM releases_vn rv JOIN releases r ON r.id = rv.id WHERE rv.vid = vn.id)) ${dir} NULLS LAST, vn.id ${dir}`,
      )
    } else if (sortBy === 'downloads') {
      orderClause = sql.raw(
        `(SELECT COUNT(*) FROM "galrc_gameDownloadStats" WHERE game_id = vn.id) ${dir} NULLS LAST, vn.id ${dir}`,
      )
    } else if (sortBy === 'views') {
      orderClause = sql.raw(
        `(SELECT COUNT(*) FROM "galrc_event_views" WHERE event_type = 'game_view' AND target_id = vn.id) ${dir} NULLS LAST, vn.id ${dir}`,
      )
    } else {
      orderClause = sql.raw(`vn.id ${dir}, galrc_alistb.other ${dir}`)
    }

    const items = await db
      .select({
        id: vn.id,
        olang: vn.olang,
        titles: sql`
          COALESCE(
            (SELECT json_agg(row_to_json(t.*)) FROM vn_titles t WHERE t.id = vn.id),
            '[]'::json
          )
        `,
        images: sql`
          (SELECT row_to_json(i.*) FROM (SELECT id, height, width, COALESCE(c_sexual_avg, 0) AS c_sexual_avg, url FROM images i WHERE i.id = vn.c_image) i)
        `,
        other: alistb.other,
        other_datas: sql`
          (SELECT row_to_json(o.*) FROM (
            SELECT
              o2.*,
              galrc_alistb.other,
              COALESCE(
                (SELECT json_agg(row_to_json(om_sub.*)) FROM (
                  SELECT
                    om.*,
                    (SELECT row_to_json(m.*) FROM galrc_media m WHERE m.hash = om.media_hash) AS media
                  FROM galrc_other_media om
                  WHERE om.other_id = o2.id
                ) om_sub),
                '[]'::json
              ) AS other_media
            FROM galrc_other o2
            WHERE o2.id = galrc_alistb.other
          ) o)
        `,
        dl_count: sql.raw(
          '(SELECT COUNT(*)::int FROM "galrc_gameDownloadStats" WHERE game_id = vn.id)',
        ),
        vw_count: sql.raw(
          '(SELECT COUNT(*)::int FROM "galrc_event_views" WHERE event_type = \'game_view\' AND target_id = vn.id)',
        ),
      })
      .from(alistb)
      .innerJoin(vn, eq(alistb.vid, vn.id))
      .orderBy(orderClause)
      .limit(pageSize)
      .offset(offset)
    const totalCount = await this.Count()
    // Kungal 数据源优先：批量载入本页 vid 的 kungal 记录与标题，逐个覆盖
    const pageVids = items.map((i) => i.id)
    const kungalRows = pageVids.length
      ? await db
          .select({
            id: kungalWorks.id,
            vndbId: kungalWorks.vndbId,
            coverUrl: kungalWorks.coverUrl,
            coverWidth: kungalWorks.coverWidth,
            coverHeight: kungalWorks.coverHeight,
          })
          .from(kungalWorks)
          .where(inArray(kungalWorks.vndbId, pageVids))
      : []
    const kungalMap = new Map(kungalRows.map((r) => [r.vndbId, r]))
    let kungalTitlesMap = new Map<string, Array<Record<string, unknown>>>()
    if (kungalRows.length > 0) {
      const kt = await db
        .select({
          workId: kungalWorkTitles.workId,
          lang: kungalWorkTitles.lang,
          official: kungalWorkTitles.official,
          title: kungalWorkTitles.title,
          latin: kungalWorkTitles.latin,
          main: kungalWorkTitles.main,
        })
        .from(kungalWorkTitles)
        .where(
          inArray(
            kungalWorkTitles.workId,
            kungalRows.map((r) => r.id),
          ),
        )
      kungalTitlesMap = new Map()
      for (const row of kt) {
        const list = kungalTitlesMap.get(row.workId) ?? []
        list.push({
          id: row.workId,
          lang: row.lang,
          official: row.official,
          title: row.title,
          latin: row.latin,
          main: row.main,
        })
        kungalTitlesMap.set(row.workId, list)
      }
    }
    // Transform image URLs: replace VNDB host with configured CDN (kungal 记录用 kungal 封面)
    for (const item of items) {
      const kungalWork = kungalMap.get(item.id)
      const img = item.images as Record<string, unknown> | null
      if (kungalWork && kungalTitlesMap.has(kungalWork.id)) {
        // 标题按语言合并：kungal 优先，缺的语言用 vndb 补（保证 olang 标题恒在）
        const kt = kungalTitlesMap.get(kungalWork.id)!
        const vt = Array.isArray(item.titles) ? (item.titles as any[]) : []
        const kLangs = new Set(
          kt.map((t) => t.lang).filter((l): l is string => !!l),
        )
        ;(item as any).titles = [
          ...kt,
          ...vt.filter((t) => !kLangs.has(t.lang as string)),
        ]
      }
      const kcoverPortrait =
        kungalWork?.coverUrl != null &&
        kungalWork.coverWidth != null &&
        kungalWork.coverHeight != null &&
        kungalWork.coverHeight >= kungalWork.coverWidth
      if (kungalWork && kcoverPortrait && img) {
        img.url = kungalWork.coverUrl
        img.imageUrl = kungalWork.coverUrl
        if (kungalWork.coverWidth) img.width = kungalWork.coverWidth
        if (kungalWork.coverHeight) img.height = kungalWork.coverHeight
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
    const datas = {
      items,
      currentPage: pageIndex,
      totalPages,
      totalCount,
    }
    if (useCache) {
      void setKv(cacheKey, JSON.stringify(datas), 60 * 60 * 2)
    }
    return datas
  },
  async InfoGet({ id }: GameModel.infoId) {
    const cacheKey = `galzy:game:info:${id}`
    const redisData = await getKv(cacheKey)

    if (redisData) {
      try {
        const cached = JSON.parse(redisData)
        // 历史缓存条目缺 imageUrl（imageUrl 特性上线前写入）→ 删除重建。
        // 注意：详情响应的 image 是 Drizzle 关系行（cSexualAvg 驼峰），
        // 不要用列表面的 c_sexual_avg 判存亡（此前误用导致缓存永远失效、每次全量查库）。
        if (
          !cached?.vn ||
          (cached?.vn?.image && !('imageUrl' in cached.vn.image))
        ) {
          await delKv(cacheKey)
        } else {
          return cached
        }
      } catch {
        await delKv(cacheKey)
      }
    }

    const idIsNumber = /^\d+$/.test(id)
    const queryDb = async () => {
      // Determine VNDB vid from the input early, so we can parallelize
      let lookupVid: string | null = null
      if (!idIsNumber) {
        lookupVid = id
      } else {
        // Resolve vid from alistb first (single indexed lookup)
        const row = await db
          .select({ vid: alistb.vid })
          .from(alistb)
          .where(eq(alistb.other, Number(id)))
          .limit(1)
          .then((r) => r[0])
        lookupVid = row?.vid ?? null
      }

      // Run main data fetch and producer query in parallel
      const officialExpr = sql<boolean>`BOOL_OR(${releases.official})`
      const firstReleaseExpr = min(releases.released)

      const producersPromise = lookupVid
        ? db
            .select({
              id: producers.id,
              name: producers.name,
              latin: producers.latin,
              alias: producers.alias,
              type: producers.type,
              count: countAll(),
              is_dev: sql<boolean>`BOOL_OR(${releasesProducers.developer})`,
              is_pub: sql<boolean>`BOOL_OR(${releasesProducers.publisher})`,
              official: officialExpr,
              first_release: firstReleaseExpr,
            })
            .from(releasesVn)
            .innerJoin(
              releasesProducers,
              eq(releasesProducers.id, releasesVn.id),
            )
            .innerJoin(releases, eq(releases.id, releasesVn.id))
            .innerJoin(producers, eq(producers.id, releasesProducers.pid))
            .where(eq(releasesVn.vid, lookupVid))
            .groupBy(
              producers.id,
              producers.name,
              producers.latin,
              producers.alias,
              producers.type,
            )
            .orderBy(
              desc(officialExpr),
              sql`${asc(firstReleaseExpr)} NULLS LAST`,
            )
        : Promise.resolve(
            [] as {
              id: string
              name: string | null
              latin: string | null
              alias: string | null
              type: string | null
              count: number
              is_dev: boolean
              is_pub: boolean
              official: boolean
              first_release: string | null
            }[],
          )

      const [data, producersData] = await Promise.all([
        db.query.alistb.findFirst({
          columns: { id: true, vid: true, other: true, path: true },
          with: {
            vn: {
              with: {
                titles: true,
                image: true,
                releasesVn: {
                  with: {
                    release: true,
                  },
                },
              },
            },
            otherData: {
              with: {
                media: {
                  with: {
                    media: true,
                  },
                },
              },
            },
          },
          where: idIsNumber ? eq(alistb.other, Number(id)) : eq(alistb.vid, id),
        }),
        producersPromise,
      ])

      if (!data) {
        throw status(404, `未找到 id=${id} 对应的游戏信息`)
      }

      // released_first: 从 releasesVn 中计算最早的 release 日期
      const releasesDates = data.vn?.releasesVn
        ?.map((rv) => rv.release?.released)
        ?.filter((r): r is string => r !== null && r !== undefined)
      let released_first =
        releasesDates && releasesDates.length > 0
          ? releasesDates.sort((a, b) => a.localeCompare(b))[0]
          : null

      if (data.vn?.image) {
        // Drizzle 的 image 关系类型与 legacy 列名合并成 string & Image,
        // 无法表达新增的 imageUrl 字段,此处做显式断言
        const img = data.vn.image as unknown as {
          id: string
          [key: string]: unknown
        }
        img.imageUrl = data.vn.image.id
          ? buildCoverUrl(
              data.vn.image.id,
              data.vn.image.width,
              data.vn.image.height,
            )
          : null
        if (data.vn.image.url) {
          data.vn.image.url = transformStoredUrl(data.vn.image.url)
        }
      }

      // ── Kungal 数据源优先合并（第二数据源）：有 kungal 记录 → 覆盖标题/封面/简介/首发日，
      //    缺字段回退 vndb。前端零改动（仍消费 vn.titles / vn.image / vn.description / released_first）。
      if (lookupVid) {
        const kungalWork = await db
          .select({
            id: kungalWorks.id,
            vndbId: kungalWorks.vndbId,
            coverUrl: kungalWorks.coverUrl,
            coverWidth: kungalWorks.coverWidth,
            coverHeight: kungalWorks.coverHeight,
            intro: kungalWorks.intro,
            releasedFirst: kungalWorks.releasedFirst,
          })
          .from(kungalWorks)
          .where(eq(kungalWorks.vndbId, lookupVid))
          .limit(1)
          .then((r) => r[0])
        if (kungalWork && data.vn) {
          const ktitles = await db
            .select({
              lang: kungalWorkTitles.lang,
              official: kungalWorkTitles.official,
              title: kungalWorkTitles.title,
              latin: kungalWorkTitles.latin,
              main: kungalWorkTitles.main,
            })
            .from(kungalWorkTitles)
            .where(eq(kungalWorkTitles.workId, kungalWork.id))
          // 标题按语言合并：kungal 优先，kungal 缺的语言用 vndb 补
          // （kungal localized 常缺 olang 标题，整体替换会让前端按 lang 查找扑空显示 null）
          const vndbTitles = ((data.vn as any).titles ?? []) as Array<{
            lang: string | null
            [key: string]: unknown
          }>
          const kungalLangs = new Set(
            ktitles.map((t) => t.lang).filter((l): l is string => !!l),
          )
          const mergedTitles = [
            ...ktitles.map((t) => ({
              id: kungalWork.id,
              lang: t.lang,
              official: t.official,
              title: t.title,
              latin: t.latin,
              main: t.main,
            })),
            ...vndbTitles
              .filter((t) => !kungalLangs.has(t.lang as string))
              .map((t) => ({ ...t })),
          ]
          if (mergedTitles.length > 0) {
            ;(data.vn as any).titles = mergedTitles
          }
          // 封面：kungal 竖版封面才优先（横版多为目录数据错误，如把同人图/截图当封面，回退 vndb）
          const kcoverPortrait =
            kungalWork.coverUrl &&
            kungalWork.coverWidth != null &&
            kungalWork.coverHeight != null &&
            kungalWork.coverHeight >= kungalWork.coverWidth
          if (kcoverPortrait && data.vn.image) {
            const img = data.vn.image as unknown as {
              id: string
              url: string | null
              imageUrl: string | null
              width: number | null
              height: number | null
              [key: string]: unknown
            }
            img.url = kungalWork.coverUrl
            img.imageUrl = kungalWork.coverUrl // kungal CDN 绝对地址，不经过 buildCoverUrl/transformStoredUrl
            if (kungalWork.coverWidth) img.width = kungalWork.coverWidth
            if (kungalWork.coverHeight) img.height = kungalWork.coverHeight
          }
          if (kungalWork.intro) {
            ;(data.vn as any).description = kungalWork.intro
          }
          if (kungalWork.releasedFirst) {
            released_first = kungalWork.releasedFirst
          }
        }
      }

      return {
        ...data,
        released_first,
        producers: producersData,
      }
    }

    const lockKey = `lock:${cacheKey}`
    const lockVal = crypto.randomUUID()
    const locked = await acquireLockKv(lockKey, lockVal, 5000)
    if (locked) {
      try {
        const doubleCheck = await getKv(cacheKey)
        if (doubleCheck) {
          try {
            return JSON.parse(doubleCheck)
          } catch {
            await delKv(cacheKey)
          }
        }

        const data = await queryDb()
        const result = structuredClone(data)
        void setKv(cacheKey, JSON.stringify(result), 60 * 60 * 6)

        return result
      } finally {
        void releaseLockKv(lockKey, lockVal)
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, 100))
      const retryData = await getKv(cacheKey)
      if (retryData) {
        try {
          return JSON.parse(retryData)
        } catch {
          await delKv(cacheKey)
        }
      }

      const data = await queryDb()
      return data
    }
  },
  async OpenListFiles({
    id,
  }: GameModel.OpenListFiles): Promise<GameModel.TreeNode[]> {
    const cacheKey = `OpenListFiles:${id}`
    const redisData = await getKv(cacheKey)

    if (redisData) {
      try {
        return JSON.parse(redisData) as DataType
      } catch {
        await delKv(cacheKey)
      }
    }
    const viddata = (await db
      .select({
        id: alistb.id,
        vid: alistb.vid,
        other: alistb.other,
        path: alistb.path,
      })
      .from(alistb)
      .where(eq(alistb.vid, id))
      .limit(1)
      .then((r: any) => r[0])) as
      | { id: string; vid: string | null; other: number | null; path: any }
      | undefined

    type RawItem = {
      name: string
      size: number
      is_dir: boolean
      type: number
    }

    const fetchList = async (parent: string): Promise<RawItem[]> => {
      try {
        const files = await listCloudreveFiles(pathToCloudreveUri(parent))
        return files.map((file) => ({
          name: file.name,
          size: file.size,
          is_dir: file.type === 1,
          type: file.type,
        }))
      } catch {
        return []
      }
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
    if (!viddata?.path) throw status(404, `未找到相关文件`)

    const data = await buildAllTrees(viddata?.path)
    void setKv(cacheKey, JSON.stringify(data), 60 * 6)
    type DataType = typeof data
    return data
  },
  async DataFilteringStats() {
    const [result] = await db
      .select({
        onlyOther: sql<number>`count(*) filter (where ${alistb.other} is not null and ${alistb.vid} is null)`,
        bothExist: sql<number>`count(*) filter (where ${alistb.vid} is not null and ${alistb.other} is not null)`,
        onlyVid: sql<number>`count(*) filter (where ${alistb.vid} is not null and ${alistb.other} is null)`,
        all: countAll(),
      })
      .from(alistb)
    return {
      onlyOther: Number(result.onlyOther) ?? 0,
      bothExist: Number(result.bothExist) ?? 0,
      onlyVid: Number(result.onlyVid) ?? 0,
      all: Number(result.all) ?? 0,
    }
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

    // [ ] [延后] 数据管理界面标题和别名搜索

    let whereConditions: any[] = []
    if (otherId != null && (vid == null || vid === undefined)) {
      whereConditions = [isNotNull(alistb.other), isNull(alistb.vid)]
    } else if (vid != null && otherId != null) {
      whereConditions = [isNotNull(alistb.vid), isNotNull(alistb.other)]
    } else if (vid != null && (otherId == null || otherId === undefined)) {
      whereConditions = [isNotNull(alistb.vid), isNull(alistb.other)]
    }

    const countFilter =
      whereConditions.length > 0 ? and(...whereConditions) : undefined
    const totalResult = await db
      .select({ count: countAll() })
      .from(alistb)
      .where(countFilter)
      .then((r) => r[0])

    const total = totalResult?.count ?? 0

    const numQuery = extractNumber(query)

    const dataWhereConditions = [...whereConditions]
    if (numQuery !== null && numQuery !== undefined) {
      dataWhereConditions.push(
        or(like(alistb.vid, query), eq(alistb.other, numQuery)),
      )
    }

    const dataFilter =
      dataWhereConditions.length > 0 ? and(...dataWhereConditions) : undefined
    const data = await db.query.alistb.findMany({
      columns: { id: true, vid: true, other: true },
      with: { vn: true, otherData: true },
      where: dataFilter,
      limit,
      offset,
    })
    // Transform image URLs: replace VNDB host with configured CDN
    for (const row of data) {
      const img = (row as { vn?: { image?: Record<string, unknown> | null } })
        .vn?.image
      if (img?.id && !('imageUrl' in img)) {
        img.imageUrl = buildCoverUrl(
          img.id as string,
          img.width as number,
          img.height as number,
        )
      }
    }
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
      const fetchData = (tx = db) =>
        tx.query.alistb.findFirst({
          columns: { id: true, vid: true, other: true, path: true },
          with: {
            otherData: {
              with: { media: { with: { media: true } } },
            },
          },
          where: eq(alistb.vid, id),
        })

      const datas = await db.transaction(async (trx) => {
        let data = await fetchData(trx)
        if (data?.otherData === null) {
          const newOtherId = await trx
            .insert(others)
            .values({ status: 'draft' })
            .returning({ id: others.id })
            .then((r) => r[0])
          await trx
            .update(alistb)
            .set({ other: newOtherId.id })
            .where(eq(alistb.vid, id))
          data = await fetchData(trx)
        }
        return data!.otherData
      })
      return datas
    }
    if (id.match(/^\d+$/)) {
      const fetchData = (tx = db) =>
        tx.query.others.findFirst({
          with: { media: { with: { media: true } } },
          where: eq(others.id, Number(id)),
        })

      const data = await db.transaction(async (trx) => {
        let result = await fetchData(trx)
        if (result === undefined) {
          const newOtherId = await trx
            .insert(others)
            .values({ status: 'draft' })
            .returning({ id: others.id })
            .then((r) => r[0])
          await trx
            .update(alistb)
            .set({ other: newOtherId.id })
            .where(eq(alistb.other, Number(id)))
          result = await fetchData(trx)
        }
        return result
      })
      return data
    }
  },
  async vidassociationUpdate({ id, data }: GameModel.vidassociationUpdate) {
    const hash = generateIdempotentHash({ id, data })
    const cached = await getIdempotentResult(
      `galzy:idempotent:vidassociationUpdate:${hash}`,
    )
    if (cached) {
      return cached
    }
    const ok = await acquireIdempotentKey(
      `galzy:idempotent:vidassociationUpdate:${hash}`,
      60,
    )
    if (!ok) {
      throw status(200, '重复请求')
    }
    const { title, description, alias } = data
    const titleObject = Array.isArray(title) ? JSON.stringify(title) : title
    await db
      .update(others)
      .set({
        title: titleObject,
        description: description,
        alias: alias,
      })
      .where(eq(others.id, Number(id)))
    const datas = {
      message: '更新 galrc_other 成功',
      status: 'success',
    }
    await delKv(`galzy:game:info:${id}`)
    await delKv(`galzy:game:vidassociation:${id}`)
    await delKvPattern('galzy:game:list*')
    await delKv('galzy:game:count')
    await purgeGamePages(String(id))
    await storeIdempotentResult(
      `galzy:idempotent:vidassociationUpdate:${hash}`,
      datas,
      60,
    )
    return datas
  },
  async vidassociationCreate() {
    const cached = await getIdempotentResult(
      `galzy:idempotent:vidassociationCreate:action`,
    )
    if (cached) {
      return cached as OtherId
    }
    const ok = await acquireIdempotentKey(
      `galzy:idempotent:vidassociationCreate:action`,
      2,
    )
    if (!ok) {
      throw status(200, '重复请求')
    }
    const otherId = await db.transaction(async (tx) => {
      const newOther = await tx
        .insert(others)
        .values({ status: 'draft' })
        .returning({ id: others.id })
        .then((r) => r[0])

      await tx.insert(alistb).values({
        id: String(newOther.id),
        other: newOther.id,
      })

      return newOther
    })

    await storeIdempotentResult(`vidassociationCreate:action`, otherId, 2)
    await delKvPattern('galzy:game:list*')
    await delKv('galzy:game:count')
    type OtherId = typeof otherId
    return otherId
  },
  async gameTimeNumberGet({ id, time }: GameModel.gameTimeNumberGet) {
    const mode =
      time === 'week' ? 'week' : time === 'month' ? 'month' : 'quarter'
    const res = await db.execute(sql<any>`
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
  ),
  totals AS (
    SELECT
      date_trunc(${mode}, d.created_at) AS bucket,
      COUNT(d.id)::int AS total
    FROM "galrc_gameDownloadStats" d
    WHERE d.game_id = ${id}
      AND d.created_at >= (SELECT min(start) FROM series)
      AND d.created_at <  (SELECT max(start) + CASE ${mode}
            WHEN 'week' THEN interval '1 week'
            WHEN 'month' THEN interval '1 month'
            ELSE interval '3 month'
          END FROM series)
    GROUP BY bucket
  ),
  grand AS (
    SELECT COUNT(*)::int AS total FROM "galrc_gameDownloadStats" WHERE game_id = ${id}
  )
  SELECT
    CASE
      WHEN ${mode} = 'week' THEN to_char(s.start, 'IW') || '周'
      WHEN ${mode} = 'month' THEN to_char(s.start, 'MM') || '月'
      ELSE '第' || extract(quarter from s.start) || '季度'
    END AS label,
    COALESCE(t.total, 0) AS total,
    g.total AS grand_total
  FROM series s
  LEFT JOIN totals t ON t.bucket = s.start
  CROSS JOIN grand g
  ORDER BY s.start ASC;
`)
    const rows = res as unknown as Array<{
      label: string
      total: number
      grand_total: number
    }>
    const total = rows.length > 0 ? rows[0].grand_total : 0
    return {
      total,
      res: rows.map(({ label, total: t }) => ({ label, total: t })),
    }
  },
  async quickSearch({ q, limit = 20 }: { q: string; limit?: number }) {
    const safeQ =
      q?.replace(/[+\-*/=<>!&|%^$#@~?:;'",()[\]{}\\]/g, '').trim() ?? ''

    // Exact VID match via DB fallback (e.g. v123, d456)
    const vidMatch = safeQ.match(/^([vd]\d+)$/i)
    if (vidMatch) {
      const vid = vidMatch[1].toLowerCase()
      const rows = await db
        .select({
          id: vn.id,
          alias: vn.alias,
          olang: vn.olang,
          titles_obj: sql`COALESCE((SELECT json_agg(row_to_json(t.*)) FROM (SELECT title, latin, lang FROM ${vnTitles} t WHERE t.id = ${sql.identifier('vn')}.${sql.identifier('id')}) t), '[]'::json)`,
          images: sql`(SELECT row_to_json(i.*) FROM (SELECT id, height, width, COALESCE(c_sexual_avg, 0) AS c_sexual_avg FROM ${sql.identifier('images')} i WHERE i.id = ${sql.identifier('vn')}.${sql.identifier('c_image')}) i)`,
        })
        .from(vn)
        .where(eq(vn.id, vid))
        .limit(1)
      if (rows.length > 0) {
        // Kungal 数据源优先：命中 vid 的 kungal 记录覆盖标题与封面
        const kungalWork = /^v\d+$/i.test(vid)
          ? await db
              .select({
                id: kungalWorks.id,
                vndbId: kungalWorks.vndbId,
                coverUrl: kungalWorks.coverUrl,
                coverWidth: kungalWorks.coverWidth,
                coverHeight: kungalWorks.coverHeight,
              })
              .from(kungalWorks)
              .where(eq(kungalWorks.vndbId, vid))
              .limit(1)
              .then((r) => r[0])
          : undefined
        const ktitles = kungalWork
          ? await db
              .select({
                lang: kungalWorkTitles.lang,
                official: kungalWorkTitles.official,
                title: kungalWorkTitles.title,
                latin: kungalWorkTitles.latin,
                main: kungalWorkTitles.main,
              })
              .from(kungalWorkTitles)
              .where(eq(kungalWorkTitles.workId, kungalWork.id))
          : []
        for (const row of rows) {
          const img = row.images as Record<string, unknown> | null
          if (kungalWork && ktitles.length > 0) {
            // 标题按语言合并：kungal 优先，缺的语言用 vndb 补
            const kt = ktitles.map((t) => ({
              id: kungalWork.id,
              lang: t.lang,
              official: t.official,
              title: t.title,
              latin: t.latin,
              main: t.main,
            }))
            const vt = Array.isArray((row as any).titles_obj)
              ? ((row as any).titles_obj as any[])
              : []
            const kLangs = new Set(
              kt.map((t) => t.lang).filter((l): l is string => !!l),
            )
            ;(row as any).titles_obj = [
              ...kt,
              ...vt.filter((t) => !kLangs.has(t.lang as string)),
            ]
          }
          const kcoverPortrait =
            kungalWork?.coverUrl != null &&
            kungalWork.coverWidth != null &&
            kungalWork.coverHeight != null &&
            kungalWork.coverHeight >= kungalWork.coverWidth
          if (kungalWork && kcoverPortrait && img) {
            // id 置空：外层 buildCoverUrl 兜底（img?.id）不会覆盖 kungal 封面
            img.id = null
            img.url = kungalWork.coverUrl
            img.imageUrl = kungalWork.coverUrl
            if (kungalWork.coverWidth) img.width = kungalWork.coverWidth
            if (kungalWork.coverHeight) img.height = kungalWork.coverHeight
          } else if (img?.id) {
            img.imageUrl = buildCoverUrl(
              img.id as string,
              img.width as number,
              img.height as number,
            )
          }
        }
        return rows
      }
      // Fall through to Meilisearch for fuzzy partial matches
    }

    const index = MeiliClient.index(
      process.env.MEILISEARCH_INDEXNAME || 'galzy_games',
    )
    const result = await index.search(safeQ || '', {
      limit,
      attributesToRetrieve: ['id', 'alias', 'titles_obj', 'olang', 'images'],
    })
    return result.hits.map((hit) => {
      const img = hit.images as Record<string, unknown> | null
      if (img?.id && !img.imageUrl) {
        img.imageUrl = buildCoverUrl(
          img.id as string,
          img.width as number,
          img.height as number,
        )
      } else if (img && !img.imageUrl && img.url) {
        // kungal 封面：meili 小写化 imageurl → 回填 camelCase
        img.imageUrl = img.url as string
      }
      return {
        id: hit.id,
        alias: hit.alias,
        titles_obj: hit.titles_obj,
        olang: hit.olang,
        images: hit.images,
      }
    })
  },
}
