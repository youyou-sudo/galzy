import {
  buildCoverUrl,
  bumpStatWindows,
  db,
  images,
  kungalWorks,
  shouldUseKungalCover,
  sql,
  tags,
  transformStoredUrl,
  vn,
  vnTitles,
  zhtags,
} from '@api/libs'
import { getRedisClient, isRedisEnabled } from '@api/libs/redis'
import { getWeekKey } from '@api/libs/time-window'
import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import { status } from 'elysia'
import type { ViewsModel } from './model'

// ============================================================
// 访问防刷：固定窗口计数（Redis INCR），每 IP 每端点独立限额。
// Redis 不可用时放行（fail-open），避免防刷拖垮正常访问记录。
// ============================================================
const VIEW_RATE_LIMIT = 200
const VIEW_RATE_WINDOW_SECONDS = 60 * 60 * 24

async function hitViewRateLimit(
  ip: string | null,
  scope: 'game' | 'tag' | 'topic',
): Promise<boolean> {
  if (!ip) return false
  // 开发模式 Redis 不生效：防刷逻辑停用，直接放行
  if (!isRedisEnabled) return false
  try {
    const key = `galzy:views:rl:${scope}:${ip}`
    const count = await getRedisClient().incr(key)
    if (count === 1)
      await getRedisClient().expire(key, VIEW_RATE_WINDOW_SECONDS)
    return count > VIEW_RATE_LIMIT
  } catch {
    return false
  }
}

/**
 * 本周游戏榜：浏览 ×1 + 下载 ×3，数据源是写时增量表 galrc_stat_windows。
 *
 * 旧实现每次请求都要 bitmap-scan galrc_event_views 里本周的几十万行
 * （线上 61ms/次；本地按线上量级造数 218ms），只能靠 Redis 缓存掩盖；
 * 现在只扫 (kind, window_start) 索引上「近两周 × 每个对象一行」的少量行
 * （同一造数下 5ms）。
 *
 * @param weekStartKey 周窗口起点（YYYY-MM-DD，getWeekKey()），周一当天仍是上一周
 */
async function queryGameRankings(weekStartKey: string, excludeR18 = false) {
  // r18 关闭时在 SQL 层剔除涩涩游戏，保证仍取满 30 名健康游戏（前端显示 24 个）
  const r18Filter = (idExpr: string) =>
    excludeR18
      ? sql`AND NOT EXISTS (SELECT 1 FROM ${vn} v JOIN ${images} i ON i.id = v.c_image WHERE v.id = ${sql.raw(idExpr)} AND i.c_sexual_avg >= 1)`
      : sql``
  const result = await db.execute(sql`
    SELECT target_id AS id, SUM(score)::int AS total FROM (
      SELECT target_id, total * 1 AS score
      FROM galrc_stat_windows
      WHERE kind = 'game_view' AND window_start >= ${weekStartKey}::date
      ${r18Filter('target_id')}
      UNION ALL
      SELECT target_id, total * 3 AS score
      FROM galrc_stat_windows
      WHERE kind = 'game_download' AND window_start >= ${weekStartKey}::date
      ${r18Filter('target_id')}
    ) combined
    GROUP BY id
    ORDER BY total DESC
    LIMIT 30
  `)
  return result as unknown as Array<{ id: string; total: number }>
}

/** 本周标签榜：直接对 stat_windows 的 tag_view 窗口求和（同样不再扫明细表）。 */
async function queryTagRankings(weekStartKey: string) {
  const rows = await db.execute(sql`
    SELECT target_id, SUM(total)::int AS total
    FROM galrc_stat_windows
    WHERE kind = 'tag_view' AND window_start >= ${weekStartKey}::date
    GROUP BY target_id
    ORDER BY 2 DESC
    LIMIT 30
  `)
  return (rows as unknown as Array<{ target_id: string; total: number }>).map(
    (r) => ({ targetId: r.target_id, total: r.total }),
  )
}

export const ViewsService = {
  async recordGameView(
    { gameId }: ViewsModel.recordGameView,
    ip: string | null,
  ) {
    // 限流仍走 Redis INCR（固定窗口计数，不是缓存），超限直接 429。
    if (await hitViewRateLimit(ip, 'game'))
      throw status(429, '请求过于频繁，请稍后再试喵～')
    // 写时增量：每次浏览只自增本周窗口的一行，不再写明细（明细表 450 万行 / 569MB）。
    await bumpStatWindows('game_view', gameId)
  },

  async recordTagView({ tagId }: ViewsModel.recordTagView, ip: string | null) {
    if (await hitViewRateLimit(ip, 'tag'))
      throw status(429, '请求过于频繁，请稍后再试喵～')
    await bumpStatWindows('tag_view', tagId)
  },

  /**
   * 论坛帖子阅读数（详情页挂载时上报一次）。
   *
   * 与浏览/下载计数同样是旁路统计：写失败不影响主流程（调用方 .catch()），
   * 但这里仍保留 IP 限流，避免脚本刷同一篇帖子的阅读量。
   * targetId 统一折算成 String(Number(topicId))：帖子 id 是自增整数，
   * URL 里出现前导零（/topics/007）时不能记成另一个 target。
   */
  async recordTopicView(
    { topicId }: ViewsModel.recordTopicView,
    ip: string | null,
  ) {
    if (await hitViewRateLimit(ip, 'topic'))
      throw status(429, '请求过于频繁，请稍后再试喵～')
    const numericId = Number(topicId)
    if (!Number.isSafeInteger(numericId) || numericId <= 0) return
    await bumpStatWindows('topic_view', String(numericId))
  },

  /** 标签页一次记录多个标签（含父标签链）：合并成一条多行 upsert。 */
  async recordTagViews(tagIds: string[]) {
    if (tagIds.length === 0) return
    await bumpStatWindows('tag_view', tagIds)
  },

  async getHotGames({
    r18,
  }: ViewsModel.hotGame = {}): Promise<ViewsModel.GameRankingItem[]> {
    const weekStartKey = getWeekKey()

    // r18 未开启（undefined / false）时必须在 SQL 层剔除涩涩游戏，
    // 否则 LIMIT 30 会被 R18 作品占满，内存过滤后榜单名额不足。
    const excludeR18 = r18 !== true
    const rows = await queryGameRankings(weekStartKey, excludeR18)

    if (rows.length === 0) return []

    const ids = rows.map((r) => r.id)
    // 热榜 id 是「展示身份」，可能是 'vNNN'（VNDB）或 'kgX'（kungal-only）。
    // 两类要分开查：vndb 侧按 vn.id，kungal-only 侧按 kungal work id。
    const vndbIds = ids.filter((id) => /^v\d+$/i.test(id))
    const kungalIds = ids
      .filter((id) => /^kg.+/i.test(id))
      .map((id) => id.slice(2))
    const kungalCoverCols = {
      id: kungalWorks.id,
      vndbId: kungalWorks.vndbId,
      displayName: kungalWorks.displayName,
      contentRating: kungalWorks.contentRating,
      coverUrl: kungalWorks.coverUrl,
      coverWidth: kungalWorks.coverWidth,
      coverHeight: kungalWorks.coverHeight,
      coverThumbhash: kungalWorks.coverThumbhash,
    }
    // Batch queries: VNDB image/title data and Kungal cover metadata in parallel.
    // 注意不要把第一个查询写成 `(await (…))` —— await 会在 Promise.all 被调用前
    // 先执行，两个查询就变成严格串行，白付一次完整查询延迟。
    const [titleRowsRaw, kungalRowsByVid, kungalRowsById] = await Promise.all([
      vndbIds.length > 0
        ? (db
            .select({
              id: vn.id,
              olang: vn.olang,
              imageId: images.id,
              imageWidth: images.width,
              imageHeight: images.height,
              imageUrl: images.url,
              cSexualAvg: images.cSexualAvg,
              titles: sql`COALESCE((SELECT json_agg(row_to_json(t.*)) FROM (SELECT lang, title FROM ${vnTitles} t WHERE t.id = ${sql.identifier('vn')}.${sql.identifier('id')}) t), '[]'::json)`,
            })
            .from(vn)
            .leftJoin(images, eq(vn.cImage, images.id))
            .where(inArray(vn.id, vndbIds)) as any)
        : Promise.resolve([]),
      vndbIds.length > 0
        ? db
            .select(kungalCoverCols)
            .from(kungalWorks)
            .where(inArray(kungalWorks.vndbId, vndbIds))
        : Promise.resolve([]),
      kungalIds.length > 0
        ? db
            .select(kungalCoverCols)
            .from(kungalWorks)
            .where(inArray(kungalWorks.id, kungalIds))
        : Promise.resolve([]),
    ])
    const titleRows = titleRowsRaw as Array<{
      id: string
      olang: string | null
      imageId: string | null
      imageWidth: number | null
      imageHeight: number | null
      cSexualAvg: number | null
      imageUrl: string | null
      titles: Array<{ lang: string; title: string }>
    }>
    // 键统一成展示身份：vndb 行用 vndbId，kungal-only 行用 'kg'+workId
    const kungalMap = new Map<string, (typeof kungalRowsByVid)[number]>()
    for (const row of kungalRowsByVid) {
      if (row.vndbId) kungalMap.set(row.vndbId, row)
    }
    for (const row of kungalRowsById) {
      kungalMap.set(`kg${row.id}`, row)
    }

    const titleMap = new Map<string, string | null>()
    const imageMap = new Map<
      string,
      {
        imageId: string | null
        imageWidth: number | null
        imageHeight: number | null
        imageThumbhash: string | null
        cSexualAvg: number | null
        imageUrl: string | null
      }
    >()
    for (const r of titleRows) {
      const titleObj =
        r.titles.find((t) => t.lang === 'zh-Hans') ||
        r.titles.find((t) => t.lang === 'zh') ||
        r.titles.find((t) => t.lang === r.olang)
      titleMap.set(r.id, titleObj?.title ?? null)
      imageMap.set(r.id, {
        imageId: r.imageId,
        imageWidth: r.imageWidth,
        imageThumbhash: null,
        imageUrl: r.imageUrl,
        imageHeight: r.imageHeight,
        cSexualAvg: r.cSexualAvg,
      })
    }

    const mapped: ViewsModel.GameRankingItem[] = rows.map((r) => {
      const img = imageMap.get(r.id)
      const kungal = kungalMap.get(r.id)
      // 竖版 kungal 封面优先；该条目没有任何 vndb 图（kungal-only 或 c_image 为空）
      // 时用横版兜底，避免热榜卡片只剩占位图。
      const useKungal = shouldUseKungalCover(
        {
          url: kungal?.coverUrl,
          width: kungal?.coverWidth,
          height: kungal?.coverHeight,
        },
        Boolean(img?.imageId || img?.imageUrl),
      )
      return {
        id: r.id,
        // kungal-only 条目没有 vn 标题，用 kungal 主显示名兜底
        title: titleMap.get(r.id) ?? kungal?.displayName ?? null,
        total: r.total,
        imageId: useKungal ? null : (img?.imageId ?? null),
        imageWidth: useKungal
          ? (kungal?.coverWidth ?? null)
          : (img?.imageWidth ?? null),
        imageHeight: useKungal
          ? (kungal?.coverHeight ?? null)
          : (img?.imageHeight ?? null),
        imageThumbhash: useKungal
          ? (kungal?.coverThumbhash ?? null)
          : (img?.imageThumbhash ?? null),
        imageUrl: useKungal
          ? (kungal?.coverUrl ?? null)
          : img?.imageId
            ? buildCoverUrl(img.imageId, img.imageWidth, img.imageHeight)
            : transformStoredUrl(img?.imageUrl ?? null),
        // kungal-only 没有 VNDB 图片投票，用 content_rating 映射 R18 门控口径
        cSexualAvg:
          img?.cSexualAvg ?? (kungal?.contentRating === 'r18' ? 1 : null),
      }
    })

    // r18 关闭时剔除涩涩游戏（无封面 → cSexualAvg null → 保留）
    return excludeR18 ? mapped.filter((g) => (g.cSexualAvg ?? 0) < 1) : mapped
  },

  async getHotTags(): Promise<ViewsModel.TagRankingItem[]> {
    const weekStartKey = getWeekKey()

    const rows = await queryTagRankings(weekStartKey)

    if (rows.length === 0) return []

    const tagIds = rows.map((r) => r.targetId)
    // 优先中文名，未本地化的回退 VNDB 英文名，避免显示原始 tag id；
    // 标注了不展示（exhibition = false）的标签从热门列表中剔除
    const tagRows = await db
      .select({
        id: tags.id,
        name: tags.name,
        zhName: zhtags.name,
      })
      .from(tags)
      .leftJoin(zhtags, eq(zhtags.id, tags.id))
      .where(
        and(
          inArray(tags.id, tagIds),
          or(isNull(zhtags.id), eq(zhtags.exhibition, true)),
        ),
      )

    const visibleIds = new Set(tagRows.map((r) => r.id))
    const titleMap = new Map(tagRows.map((r) => [r.id, r.zhName ?? r.name]))

    return rows
      .filter((r) => visibleIds.has(r.targetId))
      .map((r) => ({
        tag: r.targetId,
        title: titleMap.get(r.targetId) ?? null,
        total: r.total,
      }))
  },
}
