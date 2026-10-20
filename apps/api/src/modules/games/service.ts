import {
  alistb,
  buildCoverUrl,
  db,
  eventViewCountSql,
  gameDownloadCountSql,
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
  shouldUseKungalCover,
  sql,
  transformStoredUrl,
  vn,
  vnTitles,
} from '@api/libs'
import { purgeGamePages } from '@api/libs/cloudflare-cache'
import { displayIdWhere, resolveDisplayId } from '@api/libs/identity'
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
  type SQL,
} from 'drizzle-orm'
import { status } from 'elysia'
import type { GameModel } from './model'

/**
 * 合成 vn 对象时的占位语言。
 *
 * 条目只有 kungal 锚点、本地又没有 work 行时，唯一可用的标题是网盘目录名；
 * 本仓库的 Cloudreve 目录名是中文（如「转生魅魔迷宫历险记」），故按 zh-Hans 标注。
 * 具体取值不参与语义判断 —— 前端按「title.lang === vn.olang」取标题，
 * 这里保证两者一致即可让标题正常渲染，而不是再次显示空标题。
 */
const DISPLAY_FALLBACK_LANG = 'zh-Hans'

/**
 * 详情缓存的响应版本。
 *
 * 响应形状或「数据来源口径」变化时递增，让已写入 Redis 的旧响应自动作废 ——
 * 否则最长要等 6 小时 TTL 才生效。
 * v2：kungal 封面兜底（无其它图时横版封面也会被采用），此前的缓存里
 *     kungal-only 条目的 vn.image 恒为 null。
 */
const GAME_INFO_CACHE_VERSION = 2

/** VNDB relation 反向映射（seq↔preq；其余保持原值） */
const RELATION_INVERSE: Record<string, string> = {
  seq: 'preq',
  preq: 'seq',
}

/** `/games/gamelist` 响应形状，同时也是 `galzy:game:list:*` 缓存的值形状。 */
type GameListData = {
  items: unknown[]
  currentPage: number
  totalPages: number
  totalCount: number
}

/** `/games/gamelist` 单行结果形状（join 后显式收敛，见 List 内的条件 join）。 */
type GameListRow = {
  id: string
  olang: string | null
  titles: unknown
  images: unknown
  other: number | null
  other_datas: unknown
  dl_count: number
  vw_count: number
}

/**
 * 取作品的 kungal 记录：优先按 VNDB 锚点（refs 对齐），其次按 kungal work id
 * （kungal-only 条目没有 vndb 锚点）。
 */
async function loadKungalWork(
  lookupVid: string | null,
  lookupKungalId: string | null,
) {
  const columns = {
    id: kungalWorks.id,
    vndbId: kungalWorks.vndbId,
    olang: kungalWorks.olang,
    displayName: kungalWorks.displayName,
    contentRating: kungalWorks.contentRating,
    coverUrl: kungalWorks.coverUrl,
    coverWidth: kungalWorks.coverWidth,
    coverHeight: kungalWorks.coverHeight,
    coverThumbhash: kungalWorks.coverThumbhash,
    intro: kungalWorks.intro,
    releasedFirst: kungalWorks.releasedFirst,
  }
  if (lookupVid) {
    const byVid = await db
      .select(columns)
      .from(kungalWorks)
      .where(eq(kungalWorks.vndbId, lookupVid))
      .limit(1)
      .then((r) => r[0])
    if (byVid) return byVid
  }
  if (lookupKungalId) {
    return await db
      .select(columns)
      .from(kungalWorks)
      .where(eq(kungalWorks.id, lookupKungalId))
      .limit(1)
      .then((r) => r[0])
  }
  return undefined
}

/**
 * 从网盘路径里推导一个可展示的标题（kungal work 行缺失时的最后兜底）。
 *
 * 目录命名约定是 `[kungal-X]作品名` / `[vndb-vNNN]作品名`，取最后一个路径段、
 * 去掉方括号锚点前缀即可。多路径取第一条能解析出名字的。
 */
function titleFromAlistbPath(path: unknown): string | null {
  const paths = Array.isArray(path)
    ? (path as unknown[])
    : typeof path === 'string'
      ? [path]
      : []
  for (const entry of paths) {
    if (typeof entry !== 'string') continue
    const segment = entry.split('/').filter(Boolean).pop()
    if (!segment) continue
    // 去掉开头的 [vndb-…] / [kungal-…] / [other-…]，保留作品名
    const title = segment.replace(/^\[[^\]]*\]\s*/, '').trim()
    if (title) return title
  }
  return null
}

export const Game = {
  async Count() {
    const redisData = await getKv('galzy:game:count')
    if (redisData !== null && redisData !== undefined) {
      return Number(redisData)
    }
    const totalCountResult = await db
      .select({ count: countAll() })
      .from(alistb)
      .leftJoin(vn, eq(alistb.vid, vn.id))
      // 有 vn 行（常规作品）或 kungal 锚点（kungal-only 条目）都算收录；
      // vid 指向不存在 vn 的幽灵行不计入。
      // 口径必须与 Meilisearch 列表（真正的前端列表数据源）一致：那里按
      // alistb 逐行建文档，kungal 锚点缺 work 行时该条目仍会被计入总数，
      // 因此这里保留 kungal_id 判定即可，不要改成只看 vn。
      .where(or(isNotNull(vn.id), isNotNull(alistb.kungalId)))
      .then((r) => r[0])
    const total = Number(totalCountResult?.count || 0)
    void setKv('galzy:game:count', String(total), 60 * 30)
    return total
  },
  async List({
    pageIndex,
    pageSize,
    sortBy,
    order,
  }: GameModel.gameList): Promise<GameListData> {
    const cacheKey = `galzy:game:list:${pageIndex}:${pageSize}:${sortBy ?? 'id'}:${order}`
    // 三种排序都读写缓存：此前只有 id 排序走缓存，released/downloads/views
    // 每次请求都跑完整查询（端到端实测 1.8–2.2s）。计数类排序的数值持续增长，
    // 用短 TTL 换新鲜度；id/released 几乎不变，给长 TTL。
    const cacheTtl =
      sortBy === 'downloads' || sortBy === 'views' ? 60 * 10 : 60 * 60 * 2
    const offset = pageIndex * pageSize
    const dir = order === 'asc' ? 'ASC' : 'DESC'

    // 命中缓存直接返回：排序键聚合是这条查询里最贵的部分，重复访问不应重复付。
    const cached = await getKv(cacheKey)
    if (cached) {
      try {
        return JSON.parse(cached) as GameListData
      } catch {
        await delKv(cacheKey)
      }
    }

    // 排序键预聚合：把「每个候选行求值一次」的相关子查询换成「整表聚合一次 + LEFT JOIN」。
    //
    // 旧写法 `ORDER BY (SELECT COUNT(*) … WHERE target_id = vn.id)` 会让 Planner 对
    // alistb ⋈ vn 的全部候选行各跑一遍聚合 —— 实测 SubPlan loops=1984，
    // sortBy=views 515ms / downloads 290ms；预聚合后 loops=3，实测 187ms / 80ms。
    //
    // 计数走「galrc_stat_counters + 明细表」的 UNION：明细行被 TTL 清理前会先
    // rollup 进 counters，两者相加才是终身累计值（口径见 libs/stats.ts）。
    const releasedAgg = sql`(SELECT rv.vid AS target_id, MIN(r.released) AS released_first
      FROM releases_vn rv INNER JOIN releases r ON r.id = rv.id GROUP BY rv.vid) AS rel_agg`
    const kungalAgg = sql`(SELECT vndb_id AS target_id, released_first
      FROM galrc_kungal_works WHERE vndb_id IS NOT NULL) AS kw_agg`
    const viewAgg = sql`(SELECT target_id, SUM(cnt)::int AS total FROM (
        SELECT target_id, COUNT(*)::int AS cnt
          FROM galrc_event_views WHERE event_type = 'game_view' GROUP BY target_id
        UNION ALL
        SELECT target_id, total::int AS cnt
          FROM galrc_stat_counters WHERE kind = 'game_view'
      ) s GROUP BY target_id) AS vw_agg`
    const downloadAgg = sql`(SELECT target_id, SUM(cnt)::int AS total FROM (
        SELECT game_id AS target_id, COUNT(*)::int AS cnt
          FROM "galrc_gameDownloadStats" GROUP BY game_id
        UNION ALL
        SELECT target_id, total::int AS cnt
          FROM galrc_stat_counters WHERE kind = 'game_download'
      ) s GROUP BY target_id) AS dl_agg`

    let orderClause: SQL
    if (sortBy === 'released') {
      orderClause = sql`COALESCE(kw_agg.released_first, rel_agg.released_first) ${sql.raw(dir)} NULLS LAST, vn.id ${sql.raw(dir)}`
    } else if (sortBy === 'downloads') {
      orderClause = sql`COALESCE(dl_agg.total, 0) ${sql.raw(dir)} NULLS LAST, vn.id ${sql.raw(dir)}`
    } else if (sortBy === 'views') {
      orderClause = sql`COALESCE(vw_agg.total, 0) ${sql.raw(dir)} NULLS LAST, vn.id ${sql.raw(dir)}`
    } else {
      orderClause = sql`vn.id ${sql.raw(dir)}, galrc_alistb.other ${sql.raw(dir)}`
    }

    // 不同排序挂的聚合 join 不同，drizzle 的链式泛型会随之变化；这里只在拼 join
    // 时放宽类型，结果行形状仍由下方 GameListRow 断言约束。
    let listQuery: any = db
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
        dl_count: sql.raw(`${gameDownloadCountSql('vn.id')}::int`),
        vw_count: sql.raw(`${eventViewCountSql('game_view', 'vn.id')}::int`),
      })
      .from(alistb)
      .innerJoin(vn, eq(alistb.vid, vn.id))

    if (sortBy === 'released') {
      listQuery = listQuery
        .leftJoin(releasedAgg, sql`rel_agg.target_id = vn.id`)
        .leftJoin(kungalAgg, sql`kw_agg.target_id = vn.id`)
    } else if (sortBy === 'downloads') {
      listQuery = listQuery.leftJoin(downloadAgg, sql`dl_agg.target_id = vn.id`)
    } else if (sortBy === 'views') {
      listQuery = listQuery.leftJoin(viewAgg, sql`vw_agg.target_id = vn.id`)
    }

    // 分页数据与总数互不依赖，并行发出：原来顺序 await 会白吃一次完整往返
    // （跨机房时每次 200ms 级；同机部署时也能省掉一次排队）。
    const [items, totalCount] = (await Promise.all([
      listQuery.orderBy(orderClause).limit(pageSize).offset(offset),
      this.Count(),
    ])) as [GameListRow[], number]
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
            coverThumbhash: kungalWorks.coverThumbhash,
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
      if (
        kungalWork &&
        shouldUseKungalCover(
          {
            url: kungalWork.coverUrl,
            width: kungalWork.coverWidth,
            height: kungalWork.coverHeight,
          },
          Boolean(img?.id || img?.url),
        )
      ) {
        ;(item as any).images = {
          ...(img ?? { c_sexual_avg: 0 }),
          id: null,
          url: kungalWork.coverUrl,
          imageUrl: kungalWork.coverUrl,
          width: kungalWork.coverWidth,
          height: kungalWork.coverHeight,
          thumbhash: kungalWork.coverThumbhash,
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
    const datas: GameListData = {
      items,
      currentPage: pageIndex,
      totalPages,
      totalCount,
    }
    void setKv(cacheKey, JSON.stringify(datas), cacheTtl)
    return datas
  },
  async InfoGet({ id }: GameModel.infoId) {
    // 请求 id 可能是旧链接（kgX 已升级成 vNNN）或大小写异构：
    // 先归一到「展示身份」，响应里带 canonicalId 让前端 302 到最终路由。
    const canonicalId = await resolveDisplayId(id)
    if (!canonicalId) {
      throw status(404, `未找到 id=${id} 对应的游戏信息`)
    }

    const cacheKey = `galzy:game:info:${canonicalId}`
    type InfoResult = Awaited<ReturnType<typeof queryDb>>

    /**
     * 读取并校验详情缓存；版本不符、结构残缺或损坏 → 删除该键并返回 null。
     *
     * 校验点：
     * - `__cacheVersion` 必须匹配，否则是旧口径写入的响应（见常量注释）；
     * - `vn` 键必须存在：契约 §5 要求响应恒带 vn（kungal-only 也要合成），
     *   整个键不见说明是旧版本写的残缺缓存。注意「vn 为 null」不再算残缺。
     * - image 若是 Drizzle 关系行（cSexualAvg 驼峰），必须已带 imageUrl。
     */
    const readInfoCache = async (): Promise<InfoResult | null> => {
      const raw = await getKv(cacheKey)
      if (!raw) return null
      try {
        const parsed = JSON.parse(raw) as InfoResult & {
          __cacheVersion?: number
        }
        if (
          parsed === null ||
          typeof parsed !== 'object' ||
          parsed.__cacheVersion !== GAME_INFO_CACHE_VERSION ||
          !('vn' in parsed) ||
          (parsed.vn?.image && !('imageUrl' in parsed.vn.image))
        ) {
          await delKv(cacheKey)
          return null
        }
        const { __cacheVersion: _cacheVersion, ...rest } = parsed
        return rest as InfoResult
      } catch {
        await delKv(cacheKey)
        return null
      }
    }

    const writeInfoCache = (value: InfoResult) =>
      setKv(
        cacheKey,
        JSON.stringify({ ...value, __cacheVersion: GAME_INFO_CACHE_VERSION }),
        60 * 60 * 6,
      )

    const cachedInfo = await readInfoCache()
    if (cachedInfo) return cachedInfo

    const queryDb = async () => {
      // 锚点行：拿到 vid（VNDB）与 kungalId（kungal work），供下面并行查询
      const anchorRow = await db
        .select({
          id: alistb.id,
          vid: alistb.vid,
          kungalId: alistb.kungalId,
          anchorKind: alistb.anchorKind,
          displayId: alistb.displayId,
          path: alistb.path,
        })
        .from(alistb)
        .where(displayIdWhere(canonicalId))
        .limit(1)
        .then((r) => r[0])
      const lookupVid = anchorRow?.vid ?? null
      const lookupKungalId = anchorRow?.kungalId ?? null

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
          columns: {
            id: true,
            vid: true,
            other: true,
            path: true,
            anchorKind: true,
            kungalId: true,
            displayId: true,
          },
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
          where: displayIdWhere(canonicalId),
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
      //    两条来源都要查：vndb 锚点（正常作品）、kungal 锚点（kungal-only 条目，无 vn 行）。
      const kungalWork = await loadKungalWork(lookupVid, lookupKungalId)
      const kungalOnly = !data.vn
      if (kungalWork) {
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

        if (kungalOnly) {
          // kungal-only：没有 vn 行，按 kungal 数据合成一个 vn 形状的对象，
          // 让详情页/SEO/卡片无需分支即可渲染（见 CONTRACT.md §5）。
          // kungal-only 条目没有 vn 图可回退，横版封面直接用 —— 竖版门控在这里
          // 只会让页面永远空着（见 libs/image-url shouldUseKungalCover）。
          const synthesizedImage = shouldUseKungalCover(
            {
              url: kungalWork.coverUrl,
              width: kungalWork.coverWidth,
              height: kungalWork.coverHeight,
            },
            false,
          )
            ? {
                id: null,
                url: kungalWork.coverUrl,
                imageUrl: kungalWork.coverUrl,
                width: kungalWork.coverWidth,
                height: kungalWork.coverHeight,
                thumbhash: kungalWork.coverThumbhash,
                cSexualAvg: kungalWork.contentRating === 'r18' ? 1 : 0,
              }
            : null
          ;(data as any).vn = {
            id: null,
            olang: kungalWork.olang,
            alias: kungalWork.displayName,
            description: kungalWork.intro,
            cImage: null,
            imageUrl: null,
            cVotecount: null,
            cRating: null,
            cAverage: null,
            length: null,
            devstatus: null,
            syncedAt: null,
            titles: ktitles.map((t) => ({
              id: kungalWork.id,
              lang: t.lang,
              official: t.official,
              title: t.title,
              latin: t.latin,
              main: t.main,
            })),
            image: synthesizedImage,
            releasesVn: [],
          }
          released_first = kungalWork.releasedFirst ?? released_first
        } else if (data.vn) {
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
          // 封面：竖版 kungal 封面优先（横版多为目录数据错误，如把同人图/截图
          // 当封面）→ 有 vndb 图就回退 vndb；vndb 也没有图时横版封面顶上，
          // 否则页面永远只有占位图。
          if (
            shouldUseKungalCover(
              {
                url: kungalWork.coverUrl,
                width: kungalWork.coverWidth,
                height: kungalWork.coverHeight,
              },
              Boolean(data.vn?.image),
            )
          ) {
            const img = data.vn.image as unknown as Record<
              string,
              unknown
            > | null
            ;(data.vn as any).image = {
              ...(img ?? { cSexualAvg: 0 }),
              id: null,
              url: kungalWork.coverUrl,
              imageUrl: kungalWork.coverUrl, // kungal CDN 绝对地址，不经过 buildCoverUrl/transformStoredUrl
              width: kungalWork.coverWidth,
              height: kungalWork.coverHeight,
              thumbhash: kungalWork.coverThumbhash,
            }
          }
          if (kungalWork.intro) {
            ;(data.vn as any).description = kungalWork.intro
          }
          if (kungalWork.releasedFirst) {
            released_first = kungalWork.releasedFirst
          }
        }
      } else if (kungalOnly) {
        // 兜底：条目只有 kungal 锚点（网盘里是 [kungal-X] 目录），但本地
        // galrc_kungal_works 还没有对应行 —— 典型场景是新目录刚被扫描进
        // alistb、kungal 同步尚未补建 work 行，或该 work 在 kungal 侧已下线。
        //
        // 此时不合成 vn 会违反 CONTRACT §5（kungalOnly=true 必须给出 vn 形状），
        // 前端会渲染出字面 "null" 的标题与空壳封面；而且下面缓存入口的
        // 「!cached?.vn 就删缓存」判据会让这个条目永远缓存不命中。
        //
        // 数据只能从 alistb 自身取：展示标题用网盘目录名（去掉 [kungal-X] 前缀），
        // 其余字段留空，等下一次 kungal 同步补齐。
        const fallbackTitle = titleFromAlistbPath(anchorRow?.path)
        ;(data as any).vn = {
          id: null,
          olang: fallbackTitle ? DISPLAY_FALLBACK_LANG : null,
          alias: null,
          description: null,
          cImage: null,
          imageUrl: null,
          cVotecount: null,
          cRating: null,
          cAverage: null,
          length: null,
          devstatus: null,
          syncedAt: null,
          titles: fallbackTitle
            ? [
                {
                  id: lookupKungalId,
                  lang: DISPLAY_FALLBACK_LANG,
                  official: null,
                  title: fallbackTitle,
                  latin: null,
                  main: true,
                },
              ]
            : [],
          image: null,
          releasesVn: [],
        }
      }

      return {
        ...data,
        released_first,
        producers: producersData,
        // 展示身份契约（CONTRACT.md §5）：前端据此把 /kgX 302 到 /vNNN
        canonicalId,
        displayId: data.displayId ?? canonicalId,
        anchorKind: data.anchorKind ?? (lookupVid ? 'vndb' : 'kungal'),
        kungalOnly,
      }
    }

    const lockKey = `lock:${cacheKey}`
    const lockVal = crypto.randomUUID()
    const locked = await acquireLockKv(lockKey, lockVal, 5000)
    if (locked) {
      try {
        const doubleCheck = await readInfoCache()
        if (doubleCheck) return doubleCheck

        const data = await queryDb()
        const result = structuredClone(data)
        void writeInfoCache(result)

        return result
      } finally {
        void releaseLockKv(lockKey, lockVal)
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, 100))
      const retryCached = await readInfoCache()
      if (retryCached) return retryCached

      const data = await queryDb()
      return data
    }
  },
  async OpenListFiles({
    id,
  }: GameModel.OpenListFiles): Promise<GameModel.TreeNode[]> {
    // 统一按展示身份取资源行：/kgX 与 /vNNN 都能命中同一条目
    const canonicalId = (await resolveDisplayId(id)) ?? id
    const cacheKey = `OpenListFiles:${canonicalId}`
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
      .where(displayIdWhere(canonicalId))
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
      const fetchData = (tx: { query: typeof db.query } = db) =>
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
          await delKv(`galzy:game:info:${id}`)
          await delKvPattern('galzy:game:list*')
          await delKvPattern('galzy:tag:games:*')
        }
        if (!data?.otherData) {
          throw status(404, `未找到 id=${id} 对应的关联数据`)
        }
        return data.otherData
      })
      return datas
    }
    if (id.match(/^\d+$/)) {
      const fetchData = (tx: { query: typeof db.query } = db) =>
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
          await delKv(`galzy:game:info:${id}`)
          await delKvPattern('galzy:game:list*')
          await delKvPattern('galzy:tag:games:*')
        }
        if (!result) {
          throw status(404, `未找到 id=${id} 对应的条目`)
        }
        return result
      })
      return data
    }
    throw status(400, '无效的 id')
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
      throw status(409, '重复请求')
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
      throw status(409, '重复请求')
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
        anchorKind: 'other',
        displayId: String(newOther.id),
      })

      return newOther
    })

    await storeIdempotentResult(
      `galzy:idempotent:vidassociationCreate:action`,
      otherId,
      60,
    )
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
    -- 累计下载数 = 已 rollup 的历史计数 + 明细剩余行（明细会被 TTL 清理）
    SELECT (
      COALESCE((SELECT c.total FROM galrc_stat_counters c WHERE c.kind = 'game_download' AND c.target_id = ${id}), 0)
      + (SELECT COUNT(*) FROM "galrc_gameDownloadStats" WHERE game_id = ${id})
    )::int AS total
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
                coverThumbhash: kungalWorks.coverThumbhash,
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
          if (
            kungalWork &&
            shouldUseKungalCover(
              {
                url: kungalWork.coverUrl,
                width: kungalWork.coverWidth,
                height: kungalWork.coverHeight,
              },
              Boolean(img?.id || img?.url),
            )
          ) {
            // id 置空：外层 buildCoverUrl 兜底（img?.id）不会覆盖 kungal 封面
            ;(row as any).images = {
              ...(img ?? { c_sexual_avg: 0 }),
              id: null,
              url: kungalWork.coverUrl,
              imageUrl: kungalWork.coverUrl,
              width: kungalWork.coverWidth,
              height: kungalWork.coverHeight,
              thumbhash: kungalWork.coverThumbhash,
            }
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

  /** 游戏关系（VNDB relations：前作/续作/衍生等），正反向合并去重 */
  async Relations({ id }: GameModel.infoId) {
    // 与 InfoGet 同一套解析：任意形态 id → 展示身份 → 锚点行 → vid
    const canonicalId = await resolveDisplayId(id)
    if (!canonicalId) throw status(404, `未找到 id=${id} 对应的游戏信息`)
    const cacheKey = `galzy:game:relations:${canonicalId}`
    type RelResult = typeof data
    const redisData = await getKv(cacheKey)
    if (redisData) {
      try {
        return JSON.parse(redisData) as RelResult
      } catch {
        await delKv(cacheKey)
      }
    }

    const lookupVid = await db
      .select({ vid: alistb.vid })
      .from(alistb)
      .where(displayIdWhere(canonicalId))
      .limit(1)
      .then((r) => r[0]?.vid ?? null)
    // kungal-only 条目没有 vndb 锚点 → 无 VNDB relations 可言，返回空而非 404，
    // 让详情页「关系」标签正常显示"无关联作品"。
    if (!lookupVid) return []

    // BFS 传递闭包：显示整个关系连通簇（如某系列的全部作品），而非仅直接相邻。
    // 一条递归 CTE 拉出连通簇全部边（1 次往返），JS 内 BFS 分方向；
    // 深度/总数设上限防爆炸（超大集群截断并标记 truncated）。
    // 深度 6：万华镜等长系列链最长可达 6 跳（v44184 见全系列需 5-6 跳）。
    const MAX_DEPTH = 6
    const MAX_TOTAL = 100
    // 单条 SQL：递归 CTE 闭包边 + vn 数据 + kungal 数据全部折叠（json_agg 子查询），
    // 冷路径 DB 网络往返从 3 次降到 1 次（另有 Redis 检查 1 次）。
    const merged = await db.execute(sql`
      WITH RECURSIVE closure AS (
        SELECT r.id, r.vid, r.relation, r.relation_official, r.title, 1 AS depth
        FROM vn_relations r
        WHERE r.id = ${lookupVid} OR r.vid = ${lookupVid}
        UNION
        SELECT r.id, r.vid, r.relation, r.relation_official, r.title, c.depth + 1
        FROM vn_relations r
        JOIN closure c ON (r.id = c.vid OR r.vid = c.id) AND r.id <> r.vid
        WHERE c.depth < ${MAX_DEPTH}
      ),
      edge_list AS (
        SELECT DISTINCT id, vid, relation, relation_official, title FROM closure
      ),
      rel_vids AS (
        SELECT DISTINCT vv AS vid FROM (
          SELECT id AS vv FROM edge_list UNION SELECT vid AS vv FROM edge_list
        ) t
      )
      SELECT
        (SELECT COALESCE(json_agg(row_to_json(e.*)), '[]'::json) FROM edge_list e) AS edges,
        (SELECT COALESCE(json_agg(row_to_json(v.*)), '[]'::json) FROM (
          SELECT v.id, v.olang, v.c_image,
            COALESCE((SELECT json_agg(row_to_json(t.*)) FROM (
              SELECT lang, official, title, latin FROM vn_titles t WHERE t.id = v.id
            ) t), '[]'::json) AS titles_obj,
            (SELECT row_to_json(i.*) FROM (
              SELECT id, url, width, height, c_sexual_avg FROM images i WHERE i.id = v.c_image
            ) i) AS image
          FROM vn v WHERE v.id IN (SELECT vid FROM rel_vids)
        ) v) AS games,
        (SELECT COALESCE(json_agg(row_to_json(k.*)), '[]'::json) FROM (
          SELECT k.id, k.vndb_id, k.cover_url, k.cover_width, k.cover_height,
            k.cover_thumbhash,
            COALESCE((SELECT json_agg(row_to_json(kt.*)) FROM (
              SELECT lang, official, title, latin FROM galrc_kungal_work_titles kt
              WHERE kt.work_id = k.id
            ) kt), '[]'::json) AS titles
          FROM galrc_kungal_works k WHERE k.vndb_id IN (SELECT vid FROM rel_vids)
        ) k) AS kungal
    `)
    const mergedRow = merged[0] as {
      edges?: Array<{
        id: string | null
        vid: string | null
        relation: string | null
        relation_official: boolean | null
        title: string | null
      }>
      games?: Array<{
        id: string
        olang: string | null
        c_image: string | null
        titles_obj: unknown
        image: unknown
      }>
      kungal?: Array<{
        id: string
        vndb_id: string | null
        cover_url: string | null
        cover_width: number | null
        cover_height: number | null
        cover_thumbhash: string | null
        titles: unknown
      }>
    }
    const edges = (mergedRow.edges ?? []).filter((r) => r.id && r.vid)
    const vnRows = (mergedRow.games ?? []).map((g) => ({
      id: g.id,
      olang: g.olang,
      cImage: g.c_image,
      titlesObj: Array.isArray(g.titles_obj) ? g.titles_obj : [],
      image: g.image,
    }))
    const kungalRows = (mergedRow.kungal ?? []).map((k) => ({
      id: k.id,
      vndbId: k.vndb_id,
      coverUrl: k.cover_url,
      coverWidth: k.cover_width,
      coverHeight: k.cover_height,
      coverThumbhash: k.cover_thumbhash,
      titles: Array.isArray(k.titles) ? k.titles : [],
    }))
    const kungalMap = new Map(kungalRows.map((r) => [r.vndbId, r]))

    const visited = new Set<string>([lookupVid])
    const relMap = new Map<
      string,
      {
        vid: string
        relation: string
        relationOfficial: boolean | null
        title: string | null
        reverse: boolean
      }
    >()
    let frontier = [lookupVid]
    let truncated = false
    for (let depth = 0; depth < MAX_DEPTH && frontier.length; depth++) {
      const next: string[] = []
      for (const r of edges) {
        // r.vid 在当前层 → 边是 r.id → r.vid，other = r.id（反向：对方声明了指向本层节点的关系）
        // r.id 在当前层 → 边是 r.id → r.vid，other = r.vid（正向）
        const isReverse = r.vid != null && frontier.includes(r.vid)
        const other = isReverse ? r.id : r.vid
        if (!other || visited.has(other)) continue
        if (relMap.size >= MAX_TOTAL) {
          truncated = true
          break
        }
        visited.add(other)
        relMap.set(other, {
          vid: other,
          // 反向关系取逆：X 声明 seq → 本游戏，则本游戏视角 X 是前作
          relation: isReverse
            ? (RELATION_INVERSE[r.relation ?? ''] ?? r.relation ?? 'rel')
            : (r.relation ?? 'rel'),
          relationOfficial: r.relation_official,
          title: r.title,
          reverse: isReverse,
        })
        next.push(other)
      }
      if (truncated) break
      frontier = next
    }

    // vn/kungal 数据已由上方单条 SQL 的 edges/games/kungal 折叠返回
    const buildCard = (vid: string) => {
      const vnRow = vnRows.find((v) => v.id === vid)
      if (!vnRow) return null
      const kungalWork = kungalMap.get(vid)
      const vndbTitles = Array.isArray(vnRow.titlesObj)
        ? (vnRow.titlesObj as Array<{
            lang: string | null
            official: boolean | null
            title: string | null
            latin: string | null
          }>)
        : []
      const kungalTitles = kungalWork
        ? Array.isArray(kungalWork.titles)
          ? (kungalWork.titles as typeof vndbTitles)
          : []
        : []
      const kLangs = new Set(
        kungalTitles.map((t) => t.lang).filter((l): l is string => !!l),
      )
      const titlesObj = [
        ...kungalTitles.map((t) => ({
          lang: t.lang,
          official: t.official,
          title: t.title,
          latin: t.latin,
        })),
        ...vndbTitles
          .filter((t) => !kLangs.has(t.lang as string))
          .map((t) => ({
            lang: t.lang,
            official: t.official,
            title: t.title,
            latin: t.latin,
          })),
      ]
      const vndbImg = vnRow.image as {
        id: string
        url: string | null
        width: number | null
        height: number | null
        c_sexual_avg: number | null
      } | null
      // 竖版 kungal 封面优先；vndb 无图时横版也顶上（否则卡片永远占位图）。
      const useKungalCover = shouldUseKungalCover(
        {
          url: kungalWork?.coverUrl,
          width: kungalWork?.coverWidth,
          height: kungalWork?.coverHeight,
        },
        Boolean(vndbImg),
      )
      const images = useKungalCover
        ? {
            id: null,
            url: kungalWork!.coverUrl,
            imageUrl: kungalWork!.coverUrl,
            width: kungalWork!.coverWidth,
            height: kungalWork!.coverHeight,
            thumbhash: kungalWork!.coverThumbhash,
            c_sexual_avg: vndbImg?.c_sexual_avg ?? 0,
          }
        : vndbImg
          ? {
              id: vndbImg.id,
              url: vndbImg.url,
              imageUrl: vndbImg.id
                ? buildCoverUrl(vndbImg.id, vndbImg.width, vndbImg.height)
                : null,
              width: vndbImg.width,
              height: vndbImg.height,
              c_sexual_avg: vndbImg.c_sexual_avg ?? 0,
            }
          : null
      return { id: vid, olang: vnRow.olang, titles_obj: titlesObj, images }
    }

    const data = {
      id: lookupVid,
      truncated,
      relations: [...relMap.values()].map((r) => ({
        ...r,
        game: buildCard(r.vid),
      })),
    }
    void setKv(cacheKey, JSON.stringify(data), 60 * 60)
    return data
  },
}
