import {
  alistb,
  buildCoverUrl,
  cloudrevePathExists,
  db,
  eventViewCountSql,
  externalIds,
  gameDownloadCountSql,
  images,
  kungalWorks,
  kungalWorkTitles,
  MeiliClient,
  media,
  otherMedia,
  others,
  producers,
  releases,
  releasesVn,
  searchCloudreveFolders,
  siteConfig,
  sql,
  tags,
  tagsVn,
  vn,
  vnTitles,
  zhtags,
} from '@api/libs'
import { purgeByTags } from '@api/libs/cloudflare-cache'

import { acquireLockKv, delKvPattern, releaseLockKv } from '@api/libs/redis'
import { VndbSync } from '@api/modules/vndb-sync/service'
import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm'
import { status } from 'elysia'
import type { Index } from 'meilisearch'
import {
  type AlistbRow,
  CLOUDREVE_SYNC_TIME_KEY,
  type CloudreveSyncStats,
  diffCloudreveData,
} from './lib'

/** 读取 alistb 全量行，path jsonb 在 drizzle 中类型为 unknown，此处归一为 string[] | null */
async function getAlistbRows(): Promise<AlistbRow[]> {
  const rows = await db
    .select({
      id: alistb.id,
      vid: alistb.vid,
      other: alistb.other,
      path: alistb.path,
      anchorKind: alistb.anchorKind,
      kungalId: alistb.kungalId,
      displayId: alistb.displayId,
    })
    .from(alistb)
  return rows.map((r) => ({ ...r, path: r.path as string[] | null }))
}

/**
 * kungal work id（小写）→ 展示身份。两种来源：
 * ① `galrc_kungal_works.vndb_id`：该 work 已有 vndb 锚点 → 'vNNN'；
 * ② `galrc_external_ids`(kind='kungal', canonical_kind='kungal')：该 work 被合并到
 *    另一个 kungal work（且尚无 vndb 锚点）→ 'kg<currentId>'。
 *
 * 两者都归一到「展示身份」，网盘里仍在用旧 kungal id 命名的目录才不会另建条目。
 */
async function getKungalDisplayMap(): Promise<Map<string, string>> {
  const [works, merged] = await Promise.all([
    db
      .select({ id: kungalWorks.id, vndbId: kungalWorks.vndbId })
      .from(kungalWorks),
    db
      .select({
        externalId: externalIds.externalId,
        canonicalId: externalIds.canonicalId,
      })
      .from(externalIds)
      .where(
        and(
          eq(externalIds.kind, 'kungal'),
          eq(externalIds.canonicalKind, 'kungal'),
        ),
      ),
  ])
  const map = new Map<string, string>()
  for (const r of works) {
    if (!r.id) continue
    // 已知 work：展示身份用目录里的权威 id 写法（有 vndb 锚点则直接归到 vNNN）
    map.set(r.id.toLowerCase(), r.vndbId ? r.vndbId.toLowerCase() : `kg${r.id}`)
  }
  // kungal→kungal 合并后写，覆盖同 key 的旧映射
  for (const r of merged) {
    if (r.externalId && r.canonicalId) {
      map.set(r.externalId.toLowerCase(), `kg${r.canonicalId}`)
    }
  }
  return map
}

/**
 * 搜索 Cloudreve 中名称含 `[vndb-` 与 `[kungal-` 的文件夹并与 alistb 现有数据计算差异。
 * 同步（cloudreveSyncScript）与巡检（cloudreveSyncCheck）共用。
 *
 * 两次搜索按路径去重后并成一批交给 diff：同一作品若同时以两种命名出现，
 * 会在 resolveAnchors 里归并成一条（多路径），不会产生两个条目。
 */
async function collectCloudreveDiff() {
  // `[vndb-` 是主通道，失败必须整体失败（否则会把整库误判成"搜索不到"）。
  // `[kungal-` 是新增通道，单独失败只降级为空结果并告警：
  // 缺失时 diff 仍靠路径校验保护存量行，不会误删。
  const vndbItems = await searchCloudreveFolders('[vndb-')
  let kungalItems: Awaited<ReturnType<typeof searchCloudreveFolders>> = []
  try {
    kungalItems = await searchCloudreveFolders('[kungal-')
  } catch (e) {
    console.warn(
      `[Cloudreve] '[kungal-' 搜索失败，本次跳过 kungal 命名（存量行由路径校验保护）: ${e instanceof Error ? e.message : String(e)}`,
    )
  }

  const seen = new Set<string>()
  const items = [...vndbItems, ...kungalItems].filter((item) => {
    if (seen.has(item.path)) return false
    seen.add(item.path)
    return true
  })

  const [existing, kungalDisplay] = await Promise.all([
    getAlistbRows(),
    getKungalDisplayMap(),
  ])
  const diff = await diffCloudreveData(
    items.map((item) => ({
      name: item.name,
      path: item.path,
      is_dir: item.type === 1,
      size: item.size,
      type: item.type,
    })),
    existing,
    cloudrevePathExists,
    kungalDisplay,
  )
  return { foldersFound: items.length, diff }
}

export interface MeiliProgress {
  status: 'idle' | 'running' | 'completed' | 'failed'
  type: 'game' | 'tag' | 'producer' | null
  startedAt: string | null
  completedAt: string | null
  totalPages: number
  processedPages: number
  errors: number
  logs: Array<{
    time: string
    level: 'info' | 'error' | 'success'
    message: string
  }>
  lastUpdated: string
}

/**
 * Shared SELECT columns for Meilisearch game documents.
 * Centralizes the 13 correlated subqueries used by:
 * - MeiliSearchData (batch indexing)
 * - syncGameToMeili (single incremental sync)
 * - syncGameBatchToMeili (batch incremental sync)
 *
 * Each column is a scalar subquery optimized by PostgreSQL's query planner —
 * the shared definition avoids copy-paste drift across the three call sites.
 */
const gameMeiliDocBase = {
  id: vn.id,
  alias: vn.alias,
  olang: vn.olang,
  devstatus: vn.devstatus,
  rating: vn.cRating,
  votecount: vn.cVotecount,
  // 注意：子查询内的列引用必须显式限定表名（vn/kw/rv/r/t…）。
  // Drizzle 在 sql`` 模板里嵌入列对象只渲染裸列名（如 "id"），
  // 在多表 JOIN 作用域下会造成列歧义（42702）或静默绑定到错误的表。
  description: sql`COALESCE(
    (SELECT kw.intro FROM ${kungalWorks} kw WHERE kw.vndb_id = vn.id LIMIT 1),
    vn.description
  )`,
  released_first: sql`COALESCE(
    (SELECT kw.released_first FROM ${kungalWorks} kw WHERE kw.vndb_id = vn.id LIMIT 1),
    (SELECT MIN(r.released) FROM ${releasesVn} rv INNER JOIN ${releases} r ON r.id = rv.id WHERE rv.vid = vn.id AND r.released IS NOT NULL),
    ''
  )`,
  // 累计数：已 rollup 的历史计数 + 明细剩余行（明细会被 TTL 清理，见 libs/stats.ts）
  dl_count: sql.raw(`${gameDownloadCountSql('vn.id')}::int`),
  vw_count: sql.raw(`${eventViewCountSql('game_view', 'vn.id')}::int`),
  titles: sql`COALESCE(
    (SELECT json_agg(kt.title) FROM ${kungalWorkTitles} kt INNER JOIN ${kungalWorks} kw ON kw.id = kt.work_id WHERE kw.vndb_id = vn.id)::jsonb,
    '[]'::jsonb
  ) || COALESCE(
    (SELECT json_agg(t.title) FROM ${vnTitles} t WHERE t.id = vn.id)::jsonb,
    '[]'::jsonb
  )`,
  tag_names: sql`COALESCE((SELECT json_agg(DISTINCT z.name) FROM ${tagsVn} tv INNER JOIN ${zhtags} z ON tv.tag = z.id WHERE tv.vid = vn.id AND z.exhibition = TRUE), '[]'::json)`,
  tags: sql`COALESCE((SELECT json_agg(DISTINCT tv.tag) FROM ${tagsVn} tv INNER JOIN ${zhtags} z ON tv.tag = z.id WHERE tv.vid = vn.id AND z.exhibition = TRUE), '[]'::json)`,
  titles_obj: sql`COALESCE(
    (SELECT json_agg(row_to_json(kt.*)) FROM (SELECT kt.title, kt.latin, kt.lang FROM ${kungalWorkTitles} kt INNER JOIN ${kungalWorks} kw ON kw.id = kt.work_id WHERE kw.vndb_id = vn.id) kt)::jsonb,
    '[]'::jsonb
  ) || COALESCE(
    (SELECT json_agg(row_to_json(t.*)) FROM (
      SELECT t.title, t.latin, t.lang FROM ${vnTitles} t
      WHERE t.id = vn.id
        AND t.lang NOT IN (
          SELECT kt2.lang FROM ${kungalWorkTitles} kt2
          INNER JOIN ${kungalWorks} kw2 ON kw2.id = kt2.work_id
          WHERE kw2.vndb_id = vn.id AND kt2.lang IS NOT NULL
        )
    ) t)::jsonb,
    '[]'::jsonb
  )`,
  images: sql`COALESCE(
    (SELECT row_to_json(kimg.*) FROM (
      SELECT NULL::text AS id,
        kw.cover_url AS url,
         kw.cover_url AS imageUrl,
         kw.cover_width AS width,
         kw.cover_height AS height,
         kw.cover_thumbhash AS thumbhash,
        COALESCE((SELECT i.c_sexual_avg FROM ${images} i WHERE i.id = vn.c_image), 0) AS c_sexual_avg
      FROM ${kungalWorks} kw
      WHERE kw.vndb_id = vn.id AND kw.cover_url IS NOT NULL
        AND kw.cover_width IS NOT NULL AND kw.cover_height IS NOT NULL
        AND kw.cover_height >= kw.cover_width
      ORDER BY kw.synced_at DESC NULLS LAST
      LIMIT 1
    ) kimg),
    (SELECT row_to_json(i.*) FROM (SELECT i.id, i.height, i.width, COALESCE(i.c_sexual_avg, 0) AS c_sexual_avg FROM ${images} i WHERE i.id = vn.c_image) i)
  )`,
  releases: sql`COALESCE((SELECT json_agg(row_to_json(rel.*)) FROM (SELECT r.title, r.released FROM ${releasesVn} rv INNER JOIN ${releases} r ON r.id = rv.id WHERE rv.vid = vn.id) rel), '[]'::json)`,
  tags_obj: sql`COALESCE((SELECT json_agg(row_to_json(tag.*)) FROM (SELECT DISTINCT z.alias, z.name, z.id FROM ${tagsVn} tv INNER JOIN ${zhtags} z ON tv.tag = z.id WHERE tv.vid = vn.id AND z.exhibition = TRUE) tag), '[]'::json)`,
  has_download: sql`TRUE`,
}

/** Subquery-based columns used when alistb is NOT joined (incremental sync paths). */
const gameMeiliDocOtherSubquery = {
  other: sql`(SELECT ga.other FROM ${alistb} ga WHERE ga.vid = vn.id LIMIT 1)`,
  otherData: sql`(SELECT row_to_json(other_sub.*) FROM (SELECT o.id, a.other_val AS other, o.title, o.alias, COALESCE((SELECT json_agg(row_to_json(om_sub.*)) FROM (SELECT om.*, (SELECT row_to_json(m.*) FROM ${media} m WHERE m.hash = om.media_hash) AS media FROM ${otherMedia} om WHERE om.other_id = o.id) om_sub), '[]'::json) AS other_media FROM ${others} o CROSS JOIN LATERAL (SELECT ga2.other AS other_val FROM ${alistb} ga2 WHERE ga2.vid = vn.id LIMIT 1) a WHERE o.id = a.other_val) other_sub)`,
}

/** Direct-reference columns used when alistb IS joined (batch indexing path). */
const gameMeiliDocOtherDirect = {
  other: alistb.other,
  otherData: sql`(SELECT row_to_json(other_sub.*) FROM (SELECT o.id, ${alistb.other} AS other, o.title, o.alias, COALESCE((SELECT json_agg(row_to_json(om_sub.*)) FROM (SELECT om.*, (SELECT row_to_json(m.*) FROM ${media} m WHERE m.hash = om.media_hash) AS media FROM ${otherMedia} om WHERE om.other_id = o.id) om_sub), '[]'::json) AS other_media FROM ${others} o WHERE o.id = ${alistb.other}) other_sub)`,
}

/** Shared SELECT columns for Meilisearch producer documents. */
const producerMeiliDocBase = {
  id: producers.id,
  name: producers.name,
  latin: producers.latin,
  original: producers.original,
  alias: producers.alias,
  type: producers.type,
  lang: producers.lang,
  description: producers.description,
}

/** Add a frontend-compatible imageUrl to each document's images field. */
function addImageUrlToDocs(docs: Array<Record<string, unknown>>): void {
  for (const doc of docs) {
    const img = doc.images as Record<string, unknown> | null
    if (img?.id) {
      img.imageUrl = buildCoverUrl(
        img.id as string,
        img.width as number,
        img.height as number,
      )
    } else if (img && !img.imageUrl && img.url) {
      // PostgreSQL lowercases the unquoted imageUrl alias in row_to_json.
      img.imageUrl = img.url
    }
  }
}

export const CronService = {
  async cloudreveSyncScript() {
    const lockKey = 'galzy:lock:cron:runCloudreveData'
    const lockValue = crypto.randomUUID()
    const lockTimeout = 120000

    const lock = await acquireLockKv(lockKey, lockValue, lockTimeout)
    if (!lock) return null
    const startedAt = Date.now()
    try {
      const { foldersFound, diff } = await collectCloudreveDiff()

      const stats = {
        foldersFound,
        processedVids: diff.chunks.length + diff.unchanged,
        added: diff.added,
        updated: diff.updated,
        kept: diff.toKeep.length,
        deleted: diff.toDelete.length,
        renamed: diff.renamed,
      }
      const record: CloudreveSyncStats = {
        lastUpdate: Date.now(),
        ...stats,
        tookMs: Date.now() - startedAt,
      }

      await db.transaction(async (trx) => {
        const CHUNK_SIZE = 500

        // ① 改名/升级收口：先删旧主键行，再由下面的 upsert 写入新行。
        // 必须「先删后写」且同事务：alistb.display_id 上有唯一索引，
        // 顺序反了会直接撞 23505；不删则会留下两条指向同一作品的可见条目。
        for (let i = 0; i < diff.renames.length; i += CHUNK_SIZE) {
          const chunk = diff.renames.slice(i, i + CHUNK_SIZE)
          await trx.delete(alistb).where(
            inArray(
              alistb.id,
              chunk.map((r) => r.fromId),
            ),
          )
        }

        // ② Bulk UPSERT in chunks to avoid N per-row round trips。
        // 仅覆盖 vid/anchor 相关列与 path：保留 existing.other，
        // 防止覆盖管理员手工绑定的 other 关联。
        const upsertRows = [...diff.renames.map((r) => r.row), ...diff.chunks]
        for (let i = 0; i < upsertRows.length; i += CHUNK_SIZE) {
          const chunk = upsertRows.slice(i, i + CHUNK_SIZE)
          await trx
            .insert(alistb)
            .values(
              chunk.map((r) => ({
                id: r.id,
                vid: r.vid,
                other: r.other,
                path: r.path,
                anchorKind: r.anchorKind,
                kungalId: r.kungalId,
                displayId: r.displayId,
              })),
            )
            .onConflictDoUpdate({
              target: alistb.id,
              set: {
                vid: sql.raw('excluded.vid'),
                other: sql.raw('galrc_alistb.other'),
                path: sql.raw('excluded.path'),
                anchorKind: sql.raw('excluded.anchor_kind'),
                kungalId: sql.raw('excluded.kungal_id'),
                displayId: sql.raw('excluded.display_id'),
              },
            })
        }

        // ③ 删除已确认不存在的行（搜索结果缺失且所有存储路径均已验证失效），分块删除
        for (let i = 0; i < diff.toDelete.length; i += CHUNK_SIZE) {
          const chunk = diff.toDelete.slice(i, i + CHUNK_SIZE)
          await trx.delete(alistb).where(
            inArray(
              alistb.id,
              chunk.map((r) => r.id),
            ),
          )
        }

        await trx
          .insert(siteConfig)
          .values({
            key: CLOUDREVE_SYNC_TIME_KEY,
            config: record as any,
          })
          .onConflictDoUpdate({
            target: siteConfig.key,
            set: {
              config: record as any,
            },
          })
      })
      console.log('cloudreveSyncScript 运行成功喵', stats)
      // 清理游戏文件树缓存，避免旧路径/空结果残留。
      // 注：后续的 VNDB 增量同步已迁移到队列（cloudreve handler 成功后显式入队 vndb-delta），
      // 此处不再直接 void VndbSync.syncDelta()，避免双重触发且失败不可观测。
      await VndbSync.invalidateCache()
      return { ok: true, ...stats }
    } catch (e) {
      console.error('cloudreveSyncScript 运行失败喵', e)
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      }
    } finally {
      await releaseLockKv(lockKey, lockValue)
    }
  },

  /** 只读巡检：搜索 Cloudreve 并对比 alistb，报告待新增/更新/删除与无文件游戏，不落库 */
  async cloudreveSyncCheck() {
    const { foldersFound, diff } = await collectCloudreveDiff()

    // VNDB 数据存在但无 alistb 行（无文件条目）的游戏
    const [countRow] = await db
      .select({ count: count() })
      .from(vn)
      .leftJoin(alistb, eq(alistb.vid, vn.id))
      .where(isNull(alistb.vid))
    const vnNoAlistbSamples = await db
      .select({ id: vn.id })
      .from(vn)
      .leftJoin(alistb, eq(alistb.vid, vn.id))
      .where(isNull(alistb.vid))
      .orderBy(vn.id)
      .limit(100)

    return {
      foldersFound,
      processedVids: diff.chunks.length + diff.unchanged,
      added: diff.added,
      updated: diff.updated,
      kept: diff.toKeep.length,
      deleted: diff.toDelete.length,
      renamed: diff.renamed,
      anchorHits: diff.anchorHits,
      /** >0 表示同一作品存在多种网盘命名，已归并成一条（多路径） */
      collapsed: diff.collapsed,
      addedRows: diff.addedRows,
      updatedRows: diff.updatedRows,
      renamedRows: diff.renamedRows,
      staleDeadRows: diff.staleDeadRows,
      staleAliveRows: diff.staleAliveRows,
      vnWithoutAlistb: {
        total: Number(countRow?.count ?? 0),
        truncated: Number(countRow?.count ?? 0) > 100,
        samples: vnNoAlistbSamples.map((r) => r.id),
      },
    }
  },

  /** 调试用：预览 Cloudreve 搜索命中（文件名/ID/路径），不落库 */
  async cloudreveSearchPreview({
    keyword = '[vndb-',
    limit = 20,
  }: {
    keyword?: string
    limit?: number
  }) {
    const found = await searchCloudreveFolders(keyword)
    const items = found.slice(0, limit)
    const email = process.env.CLOUDREVE_EMAIL ?? ''
    const at = email.indexOf('@')
    return {
      host: process.env.CLOUDREVE_HOST,
      email: at > 1 ? `${email.slice(0, 1)}***${email.slice(at)}` : email,
      keyword,
      total: found.length,
      items: items.map(({ id, name, path, size }) => ({
        id,
        name,
        path,
        size,
      })),
    }
  },

  // 提取数据处理逻辑为独立方法，便于优化和测试
  processAlistData(alistData: Array<{ name: string }>) {
    const results: {
      vid?: string
      kungal?: string
      other?: string
      id: string
    }[] = []
    // [vndb-v123] / [kungal-X] / [other-xxx] 可同时出现，按优先级取展示键
    const idPattern = /\[(vndb-(v\d+)|kungal-([^\]\s/]+)|other-(\w+))\]/gi

    for (const item of alistData) {
      const matches = Array.from(item.name.matchAll(idPattern))
      const record: { vid?: string; kungal?: string; other?: string } = {}

      for (const match of matches) {
        if (match[2]) record.vid = match[2] // vndb-vxxx
        if (match[3]) record.kungal = match[3] // kungal-xxxx（原样大小写）
        if (match[4]) record.other = match[4] // other-xxx
      }

      // 只收集至少有一个字段的项
      if (Object.keys(record).length > 0) {
        let id = ''
        if (record.vid) {
          id = record.vid
        } else if (record.kungal) {
          id = `kg${record.kungal}`
        } else if (record.other) {
          id = record.other
        }
        if (record.other) id = `${id}-${record.other}`
        results.push({ ...record, id })
      }
    }

    return results
  },

  deduplicateResults(
    results: Array<{
      vid?: string
      kungal?: string
      other?: string
      id: string
    }>,
  ) {
    const dedupedMap = new Map<
      string,
      { vid?: string; kungal?: string; other?: string; id: string }
    >()

    for (const item of results) {
      // kungal 锚点也参与去重，否则同一 kungal 条目会重复出现
      const key =
        item.vid ||
        (item.kungal ? `kg${item.kungal}` : undefined) ||
        crypto.randomUUID()
      if (!dedupedMap.has(key)) {
        dedupedMap.set(key, item)
      }
    }

    return Array.from(dedupedMap.values())
  },

  async updateMeiliProgress(
    type: 'game' | 'tag' | 'producer',
    partial: Partial<MeiliProgress>,
  ) {
    const key =
      type === 'game'
        ? 'meiliSearchProgress_game'
        : type === 'tag'
          ? 'meiliSearchProgress_tag'
          : 'meiliSearchProgress_producer'
    const current = await this.getMeiliProgress(type)
    const updated: MeiliProgress = {
      ...current,
      ...partial,
      lastUpdated: new Date().toISOString(),
    }
    await db
      .insert(siteConfig)
      .values({ key, config: updated as any })
      .onConflictDoUpdate({
        target: siteConfig.key,
        set: { config: updated as any },
      })
  },

  async getMeiliProgress(
    type: 'game' | 'tag' | 'producer',
  ): Promise<MeiliProgress> {
    const key =
      type === 'game'
        ? 'meiliSearchProgress_game'
        : type === 'tag'
          ? 'meiliSearchProgress_tag'
          : 'meiliSearchProgress_producer'
    const row = await db
      .select({ config: siteConfig.config })
      .from(siteConfig)
      .where(eq(siteConfig.key, key))
      .limit(1)
    return (
      (row[0]?.config as MeiliProgress) ?? {
        status: 'idle',
        type: null,
        startedAt: null,
        completedAt: null,
        totalPages: 0,
        processedPages: 0,
        errors: 0,
        logs: [],
        lastUpdated: new Date().toISOString(),
      }
    )
  },

  async addMeiliLog(
    type: 'game' | 'tag' | 'producer',
    level: MeiliProgress['logs'][0]['level'],
    message: string,
  ) {
    const current = await this.getMeiliProgress(type)
    const logs = [
      ...current.logs,
      { time: new Date().toISOString(), level, message },
    ].slice(-100)
    await this.updateMeiliProgress(type, { logs })
  },

  async meiliSearchAddIndex(
    onProgress?: (processed: number, total: number) => void,
  ) {
    try {
      const { totalPages } = await this.getMeiliSearchDataInfo()

      await this.updateMeiliProgress('game', {
        status: 'running',
        type: 'game',
        startedAt: new Date().toISOString(),
        completedAt: null,
        totalPages,
        processedPages: 0,
        errors: 0,
        logs: [
          {
            time: new Date().toISOString(),
            level: 'info',
            message: `游戏索引重建开始: ${totalPages} 页`,
          },
        ],
      })

      const index = await MeiliClient.index(
        process.env.MEILISEARCH_INDEXNAME || 'galzy_games',
      )
      // 滚动模式：不清空索引（避免用户短暂搜到空结果），逐页覆盖写入，末尾差集删除过期文档。
      await this.addMeiliLog(
        'game',
        'info',
        '滚动更新开始（保留现有索引，不清空）',
      )

      const pageSize = 500
      const concurrencyLimit = 3

      for (let i = 0; i < totalPages; i += concurrencyLimit) {
        const batch = []
        for (let j = 0; j < concurrencyLimit && i + j < totalPages; j++) {
          batch.push(this.indexPageWithRetry(index, pageSize, i + j))
        }
        await Promise.all(batch)
        const processed = Math.min(i + concurrencyLimit, totalPages)
        await this.updateMeiliProgress('game', { processedPages: processed })
        onProgress?.(processed, totalPages)
        await this.addMeiliLog(
          'game',
          'info',
          `索引进度: ${processed}/${totalPages} 页`,
        )
      }

      // Configure index settings for unified search
      let task
      task = await index.updateFilterableAttributes([
        'olang',
        'devstatus',
        'tags',
        'has_download',
        'released_first',
        'images.c_sexual_avg',
      ])
      await MeiliClient.tasks.waitForTask(task.taskUid, { timeout: 300_000 })

      task = await index.updateSortableAttributes([
        'released_first',
        'rating',
        'votecount',
        'dl_count',
        'vw_count',
        'id',
      ])
      await MeiliClient.tasks.waitForTask(task.taskUid, { timeout: 300_000 })

      task = await index.updateSearchableAttributes([
        'titles',
        'alias',
        'description',
        'tag_names',
      ])
      await MeiliClient.tasks.waitForTask(task.taskUid, { timeout: 300_000 })
      await this.addMeiliLog(
        'game',
        'success',
        '已更新索引设置（筛选、排序、搜索字段）',
      )

      // 差集删除：DB 中有文件的展示身份（alistb.display_id）之外的游戏文档视为过期。
      // 口径必须是「展示身份」而不是 vid：kungal-only 条目没有 vid，
      // 用 vid 集合会把它自己的索引文档当成过期文档删掉。
      const liveVids = new Set(
        (await db.selectDistinct({ displayId: alistb.displayId }).from(alistb))
          .map((r) => r.displayId)
          .filter((v): v is string => v != null),
      )
      const pruned = await pruneStaleDocs(index, liveVids)
      await this.addMeiliLog('game', 'info', `清理过期索引文档: ${pruned} 条`)

      await this.updateMeiliProgress('game', {
        status: 'completed',
        completedAt: new Date().toISOString(),
      })
      await this.addMeiliLog('game', 'success', '游戏索引重建完成')
      // Invalidate CDN cache for affected pages
      await purgeByTags(['page-home', 'page-games'])
      // Meili 数据已变 → 搜索 API 缓存（galzy:search:*）同步失效
      await delKvPattern('galzy:search:*')
      return { code: 200 }
    } catch (e) {
      console.error('meiliSearchAddIndex 运行失败喵', e)
      await this.updateMeiliProgress('game', {
        status: 'failed',
        completedAt: new Date().toISOString(),
        errors: (await this.getMeiliProgress('game')).errors + 1,
      })
      await this.addMeiliLog('game', 'error', `重建失败: ${String(e)}`)
      throw status(500, `meiliSearchAddIndex 运行失败喵 ${e}`)
    }
  },

  async indexPageWithRetry(
    index: any,
    pageSize: number,
    pageIndex: number,
    retries = 3,
  ) {
    for (let i = 0; i < retries; i++) {
      try {
        const { items } = await MeiliSearchData(pageSize, pageIndex)
        if (items.length > 0) {
          await index.addDocuments(items)
        }
        return
      } catch (e) {
        console.error(
          `索引分页 ${pageIndex} 失败 (尝试 ${i + 1}/${retries})`,
          e,
        )
        if (i === retries - 1) throw e
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)))
      }
    }
  },

  async meiliSearchAddTag(
    onProgress?: (processed: number, total: number) => void,
  ) {
    try {
      const { totalPages } = await this.getTagDataInfo()

      await this.updateMeiliProgress('tag', {
        status: 'running',
        type: 'tag',
        startedAt: new Date().toISOString(),
        completedAt: null,
        totalPages,
        processedPages: 0,
        errors: 0,
        logs: [
          {
            time: new Date().toISOString(),
            level: 'info',
            message: `标签索引重建开始: ${totalPages} 页`,
          },
        ],
      })

      const index = await MeiliClient.index(
        process.env.MEILISEARCH_TAG_INDEXNAME || 'galrc_Tag',
      )
      // 滚动模式：不清空索引，逐页覆盖写入，末尾差集删除过期文档。
      await this.addMeiliLog(
        'tag',
        'info',
        '滚动更新开始（保留现有索引，不清空）',
      )

      const pageSize = 500
      const concurrencyLimit = 3

      for (let i = 0; i < totalPages; i += concurrencyLimit) {
        const batch = []
        for (let j = 0; j < concurrencyLimit && i + j < totalPages; j++) {
          batch.push(this.indexTagPageWithRetry(index, pageSize, i + j))
        }
        await Promise.all(batch)
        const processed = Math.min(i + concurrencyLimit, totalPages)
        await this.updateMeiliProgress('tag', { processedPages: processed })
        onProgress?.(processed, totalPages)
        await this.addMeiliLog(
          'tag',
          'info',
          `索引进度: ${processed}/${totalPages} 页`,
        )
      }

      // 差集删除：DB 中处于 exhibition 的 tag 之外的标签文档视为过期。
      const liveTagIds = new Set(
        (
          await db
            .select({ id: tags.id })
            .from(tags)
            .innerJoin(zhtags, eq(tags.id, zhtags.id))
            .where(eq(zhtags.exhibition, true))
        ).map((r) => r.id),
      )
      const pruned = await pruneStaleDocs(index, liveTagIds)
      await this.addMeiliLog('tag', 'info', `清理过期索引文档: ${pruned} 条`)

      await this.updateMeiliProgress('tag', {
        status: 'completed',
        completedAt: new Date().toISOString(),
      })
      await this.addMeiliLog('tag', 'success', '标签索引重建完成')
      await delKvPattern('galzy:search:*')
      return { code: 200 }
    } catch (e) {
      console.error('meiliSearchAddTag 运行失败喵', e)
      await this.updateMeiliProgress('tag', {
        status: 'failed',
        completedAt: new Date().toISOString(),
        errors: (await this.getMeiliProgress('tag')).errors + 1,
      })
      await this.addMeiliLog('tag', 'error', `重建失败: ${String(e)}`)
      throw status(500, `meiliSearchAddTag 运行失败喵 ${e}`)
    }
  },

  async indexTagPageWithRetry(
    index: any,
    pageSize: number,
    pageIndex: number,
    retries = 3,
  ) {
    for (let i = 0; i < retries; i++) {
      try {
        const { items } = await tagAllGet(pageSize, pageIndex)
        if (items.length > 0) {
          await index.addDocuments(items)
        }
        return
      } catch (e) {
        console.error(
          `标签索引分页 ${pageIndex} 失败 (尝试 ${i + 1}/${retries})`,
          e,
        )
        if (i === retries - 1) throw e
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)))
      }
    }
  },

  async meiliSearchAddProducer(
    onProgress?: (processed: number, total: number) => void,
  ) {
    try {
      const { totalPages } = await this.getProducerDataInfo()

      await this.updateMeiliProgress('producer', {
        status: 'running',
        type: 'producer',
        startedAt: new Date().toISOString(),
        completedAt: null,
        totalPages,
        processedPages: 0,
        errors: 0,
        logs: [
          {
            time: new Date().toISOString(),
            level: 'info',
            message: `厂商索引重建开始: ${totalPages} 页`,
          },
        ],
      })

      const index = await MeiliClient.index(
        process.env.MEILISEARCH_PRODUCER_INDEXNAME || 'galrc_Producer',
      )
      // 滚动模式：不清空索引，逐页覆盖写入，末尾差集删除过期文档。
      await this.addMeiliLog(
        'producer',
        'info',
        '滚动更新开始（保留现有索引，不清空）',
      )

      const pageSize = 500
      const concurrencyLimit = 3

      for (let i = 0; i < totalPages; i += concurrencyLimit) {
        const batch = []
        for (let j = 0; j < concurrencyLimit && i + j < totalPages; j++) {
          batch.push(this.indexProducerPageWithRetry(index, pageSize, i + j))
        }
        await Promise.all(batch)
        const processed = Math.min(i + concurrencyLimit, totalPages)
        await this.updateMeiliProgress('producer', {
          processedPages: processed,
        })
        onProgress?.(processed, totalPages)
        await this.addMeiliLog(
          'producer',
          'info',
          `索引进度: ${processed}/${totalPages} 页`,
        )
      }

      // Configure index settings
      let task
      task = await index.updateFilterableAttributes(['type', 'lang'])
      await MeiliClient.tasks.waitForTask(task.taskUid, { timeout: 300_000 })

      task = await index.updateSearchableAttributes([
        'name',
        'latin',
        'original',
        'alias',
        'description',
      ])
      await MeiliClient.tasks.waitForTask(task.taskUid, { timeout: 300_000 })

      // Finite pagination caps hits at maxTotalHits (default 1000) — raise it so
      // every producer stays reachable through the paginated browse page.
      task = await index.updatePagination({ maxTotalHits: 10000 })
      await MeiliClient.tasks.waitForTask(task.taskUid, { timeout: 300_000 })
      await this.addMeiliLog(
        'producer',
        'success',
        '已更新索引设置（筛选、搜索字段、分页上限）',
      )

      // 差集删除：DB 中已不存在的 producer 文档视为过期。
      const liveProducerIds = new Set(
        (await db.select({ id: producers.id }).from(producers)).map(
          (r) => r.id,
        ),
      )
      const pruned = await pruneStaleDocs(index, liveProducerIds)
      await this.addMeiliLog(
        'producer',
        'info',
        `清理过期索引文档: ${pruned} 条`,
      )

      await this.updateMeiliProgress('producer', {
        status: 'completed',
        completedAt: new Date().toISOString(),
      })
      await this.addMeiliLog('producer', 'success', '厂商索引重建完成')
      await delKvPattern('galzy:search:*')
      return { code: 200 }
    } catch (e) {
      console.error('meiliSearchAddProducer 运行失败喵', e)
      await this.updateMeiliProgress('producer', {
        status: 'failed',
        completedAt: new Date().toISOString(),
        errors: (await this.getMeiliProgress('producer')).errors + 1,
      })
      await this.addMeiliLog('producer', 'error', `重建失败: ${String(e)}`)
      throw status(500, `meiliSearchAddProducer 运行失败喵 ${e}`)
    }
  },

  async indexProducerPageWithRetry(
    index: Index,
    pageSize: number,
    pageIndex: number,
    retries = 3,
  ) {
    for (let i = 0; i < retries; i++) {
      try {
        const { items } = await producerAllGet(pageSize, pageIndex)
        if (items.length > 0) {
          await index.addDocuments(items)
        }
        return
      } catch (e) {
        console.error(
          `厂商索引分页 ${pageIndex} 失败 (尝试 ${i + 1}/${retries})`,
          e,
        )
        if (i === retries - 1) throw e
        const { promise, resolve } = Promise.withResolvers<void>()
        setTimeout(resolve, 1000 * (i + 1))
        await promise
      }
    }
  },

  // Incremental sync: push one VN to Meilisearch by ID
  async syncGameToMeili(vnId: string) {
    const index = MeiliClient.index(
      process.env.MEILISEARCH_INDEXNAME || 'galzy_games',
    )
    try {
      const doc = await db
        .select({
          ...gameMeiliDocBase,
          ...gameMeiliDocOtherSubquery,
        })
        .from(vn)
        .where(eq(vn.id, vnId))
        .limit(1)
      if (doc.length > 0 && doc[0]) {
        addImageUrlToDocs(doc)
        await index.updateDocuments([doc[0]])
        console.log(`[Meili] 增量更新: ${vnId}`)
      }
    } catch (e) {
      console.error(`[Meili] 增量更新失败 ${vnId}:`, e)
    }
  },

  // Incremental sync: push a batch of VN IDs to Meilisearch
  async syncGameBatchToMeili(vnIds: string[]) {
    if (vnIds.length === 0) return
    const index = MeiliClient.index(
      process.env.MEILISEARCH_INDEXNAME || 'galzy_games',
    )
    try {
      const docs = await db
        .select({
          ...gameMeiliDocBase,
          ...gameMeiliDocOtherSubquery,
        })
        .from(vn)
        .where(inArray(vn.id, vnIds))
      if (docs.length > 0) {
        addImageUrlToDocs(docs)
        await index.updateDocuments(docs, { primaryKey: 'id' })
      }
    } catch (e) {
      console.error(`[Meili] 批量增量更新失败:`, e)
    }
  },

  // Incremental sync: push one producer to Meilisearch by ID
  async syncProducerToMeili(pid: string) {
    const index = MeiliClient.index(
      process.env.MEILISEARCH_PRODUCER_INDEXNAME || 'galrc_Producer',
    )
    try {
      const doc = await db
        .select(producerMeiliDocBase)
        .from(producers)
        .where(eq(producers.id, pid))
        .limit(1)
      if (doc.length > 0 && doc[0]) {
        await index.updateDocuments([doc[0]])
        console.log(`[Meili] 厂商增量更新: ${pid}`)
      }
    } catch (e) {
      console.error(`[Meili] 厂商增量更新失败 ${pid}:`, e)
    }
  },

  // Incremental sync: push a batch of producer IDs to Meilisearch
  async syncProducerBatchToMeili(pids: string[]) {
    if (pids.length === 0) return
    const index = MeiliClient.index(
      process.env.MEILISEARCH_PRODUCER_INDEXNAME || 'galrc_Producer',
    )
    try {
      const docs = await db
        .select(producerMeiliDocBase)
        .from(producers)
        .where(inArray(producers.id, pids))
      if (docs.length > 0) {
        await index.updateDocuments(docs, { primaryKey: 'id' })
        console.log(`[Meili] 厂商批量增量更新: ${docs.length} docs`)
      }
    } catch (e) {
      console.error(`[Meili] 厂商批量增量更新失败:`, e)
    }
  },

  // 辅助方法：获取总页数信息
  async getMeiliSearchDataInfo() {
    const totalCountResult = await db
      .select({ count: count() })
      .from(alistb)
      .then((r) => r[0])

    const totalCount = Number(totalCountResult?.count || 0)
    const totalPages = Math.ceil(totalCount / 500)

    return { totalCount, totalPages }
  },

  async getTagDataInfo() {
    const totalCountResult = await db
      .select({ count: count() })
      .from(tags)
      .innerJoin(zhtags, eq(tags.id, zhtags.id))
      .where(eq(zhtags.exhibition, true))
      .then((r) => r[0])

    const totalCount = Number(totalCountResult?.count || 0)
    const totalPages = Math.ceil(totalCount / 500)

    return { totalCount, totalPages }
  },

  async getProducerDataInfo() {
    const totalCountResult = await db
      .select({ count: count() })
      .from(producers)
      .then((r) => r[0])

    const totalCount = Number(totalCountResult?.count || 0)
    const totalPages = Math.ceil(totalCount / 500)

    return { totalCount, totalPages }
  },
}

/**
 * kungal-only 条目的 Meilisearch 文档列（无 vn 行，数据全部来自 galrc_kungal_works）。
 *
 * R18 门控：vn 侧的 c_sexual_avg 来自 VNDB 图片投票；kungal-only 没有该数据，
 * 用 content_rating='r18' 映射为 c_sexual_avg=1，让搜索侧的 `c_sexual_avg >= 1`
 * 过滤口径对两类条目一致（见 CONTRACT.md §7）。
 */
const kungalOnlyMeiliDoc = {
  id: alistb.displayId,
  alias: kungalWorks.displayName,
  olang: kungalWorks.olang,
  devstatus: sql`NULL::smallint`,
  rating: sql`NULL::real`,
  votecount: sql`NULL::int`,
  description: kungalWorks.intro,
  released_first: sql`COALESCE(${kungalWorks.releasedFirst}, '')`,
  dl_count: sql.raw(`${gameDownloadCountSql('galrc_alistb.display_id')}::int`),
  vw_count: sql.raw(
    `${eventViewCountSql('game_view', 'galrc_alistb.display_id')}::int`,
  ),
  // json_agg 返回 json（不是 jsonb），与 '[]'::jsonb 做 COALESCE 前必须显式转 jsonb
  titles: sql`COALESCE((SELECT json_agg(kt.title) FROM galrc_kungal_work_titles kt WHERE kt.work_id = ${kungalWorks.id})::jsonb, '[]'::jsonb)`,
  tag_names: sql`'[]'::json`,
  tags: sql`'[]'::json`,
  titles_obj: sql`COALESCE((SELECT json_agg(row_to_json(kt.*)) FROM (SELECT kt.title, kt.latin, kt.lang FROM galrc_kungal_work_titles kt WHERE kt.work_id = ${kungalWorks.id}) kt)::jsonb, '[]'::jsonb)`,
  // 封面直接由「当前 join 到的这一行」构造，不能再写子查询：
  // 子查询里 FROM galrc_kungal_works 会遮蔽外层同名表引用，
  // 变成"全表任意一条有竖版封面的行"，等于给所有 kungal-only 文档贴错封面。
  images: sql`CASE
      WHEN ${kungalWorks.coverUrl} IS NOT NULL
       AND ${kungalWorks.coverWidth} IS NOT NULL
       AND ${kungalWorks.coverHeight} IS NOT NULL
       AND ${kungalWorks.coverHeight} >= ${kungalWorks.coverWidth}
      THEN jsonb_build_object(
        'id', NULL,
        'url', ${kungalWorks.coverUrl},
        'width', ${kungalWorks.coverWidth},
        'height', ${kungalWorks.coverHeight},
        'thumbhash', ${kungalWorks.coverThumbhash},
        'c_sexual_avg',
          CASE WHEN ${kungalWorks.contentRating} = 'r18' THEN 1 ELSE 0 END
      )
      ELSE NULL
    END`,
  releases: sql`'[]'::json`,
  tags_obj: sql`'[]'::json`,
  has_download: sql`TRUE`,
  other: alistb.other,
  otherData: gameMeiliDocOtherDirect.otherData,
}

/**
 * 分页构造游戏索引文档。
 *
 * 驱动表必须是 alistb：kungal-only 条目没有 vn 行，早先的 `innerJoin(vn)` 会把
 * 这类条目整条漏掉（既不被索引，也会在差集删除里被当成过期文档）。
 * 因此按 alistb 分页后再分两路取数：有 vid 的走 vn 聚合，没有的走 kungal 聚合。
 *
 * 导出以便单测/校验脚本直接验证文档形状（两路查询的字段必须对齐）。
 */
export const MeiliSearchData = async (pageSize: number, pageIndex: number) => {
  const offset = pageIndex * pageSize

  const page = await db
    .select({
      displayId: alistb.displayId,
      vid: alistb.vid,
      kungalId: alistb.kungalId,
    })
    .from(alistb)
    // 必须显式排序：无 ORDER BY 的 LIMIT/OFFSET 翻页不保证各页不重不漏
    .orderBy(asc(alistb.displayId))
    .limit(pageSize)
    .offset(offset)

  const vndbDisplayIds = page.filter((r) => r.vid).map((r) => r.displayId)
  const kungalDisplayIds = page
    .filter((r) => !r.vid && r.kungalId)
    .map((r) => r.displayId)

  const [vndbDocs, kungalDocs] = await Promise.all([
    vndbDisplayIds.length > 0
      ? db
          .select({
            ...gameMeiliDocBase,
            id: alistb.displayId,
            ...gameMeiliDocOtherDirect,
          })
          .from(alistb)
          .innerJoin(vn, eq(alistb.vid, vn.id))
          .where(inArray(alistb.displayId, vndbDisplayIds))
      : Promise.resolve([] as Array<Record<string, unknown>>),
    kungalDisplayIds.length > 0
      ? db
          .select(kungalOnlyMeiliDoc)
          .from(alistb)
          .innerJoin(kungalWorks, eq(kungalWorks.id, alistb.kungalId))
          .where(inArray(alistb.displayId, kungalDisplayIds))
      : Promise.resolve([] as Array<Record<string, unknown>>),
  ])

  const items = [...vndbDocs, ...kungalDocs] as Array<Record<string, unknown>>
  addImageUrlToDocs(items)
  return { items }
}

const tagAllGet = async (pageSize: number, pageIndex: number) => {
  const offset = pageIndex * pageSize

  const items = await db
    .select({
      id: tags.id,
      name: tags.name,
      zh_name: zhtags.name,
      alias: zhtags.alias,
    })
    .from(tags)
    .innerJoin(zhtags, eq(tags.id, zhtags.id))
    .where(eq(zhtags.exhibition, true))
    // 必须显式排序：无 ORDER BY 的 LIMIT/OFFSET 翻页不保证各页不重不漏
    // （index-only scan、并行 worker 或并发写入都会改变顺序），
    // 会让 Meilisearch 标签索引重建静默漏掉标签。与 tags/service.ts 的
    // tagAllGet 保持同一顺序。
    .orderBy(asc(tags.id))
    .limit(pageSize)
    .offset(offset)

  return { items }
}

const producerAllGet = async (pageSize: number, pageIndex: number) => {
  const offset = pageIndex * pageSize

  const items = await db
    .select(producerMeiliDocBase)
    .from(producers)
    .orderBy(asc(producers.id))
    .limit(pageSize)
    .offset(offset)

  return { items }
}

// ── 滚动重建辅助：差集删除过期文档 ──────────────────────────────
// 滚动模式不「清空重建」，而是逐页 updateDocuments/addDocuments 后，
// 只删除「DB 中已不存在」的过期文档，全程保留旧文档可被搜索（无空窗）。

const MEILI_PRUNE_CHUNK = 1000

/** 分页遍历 Meili 索引，取全部文档主键 id。 */
async function collectMeiliIds(index: Index): Promise<string[]> {
  const ids: string[] = []
  let offset = 0
  for (;;) {
    const page = await index.getDocuments({
      limit: MEILI_PRUNE_CHUNK,
      offset,
      fields: ['id'],
    })
    if (!page.results || page.results.length === 0) break
    for (const doc of page.results) {
      if (doc.id != null) ids.push(String(doc.id))
    }
    offset += page.results.length
    if (page.results.length < MEILI_PRUNE_CHUNK) break
  }
  return ids
}

/**
 * 删除 Meili 索引中「existingIds 集合之外」的过期文档。
 * 返回删除数量；删除失败会抛错（调用方据此把 job 标记失败，保守只残留不误删）。
 */
async function pruneStaleDocs(
  index: Index,
  existingIds: Set<string>,
): Promise<number> {
  const meiliIds = await collectMeiliIds(index)
  const stale = meiliIds.filter((id) => !existingIds.has(id))
  if (stale.length === 0) return 0
  for (let i = 0; i < stale.length; i += MEILI_PRUNE_CHUNK) {
    await index.deleteDocuments(stale.slice(i, i + MEILI_PRUNE_CHUNK))
  }
  return stale.length
}
