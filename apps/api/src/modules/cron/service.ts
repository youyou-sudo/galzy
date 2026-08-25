import {
  alistb,
  buildCoverUrl,
  cloudrevePathExists,
  db,
  eventViews,
  gameDownloadStats,
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
import { asc, count, desc, eq, inArray, isNull } from 'drizzle-orm'
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
    })
    .from(alistb)
  return rows.map((r) => ({ ...r, path: r.path as string[] | null }))
}

/**
 * 搜索 Cloudreve 中名称含 [vndb- 的文件夹并与 alistb 现有数据计算差异。
 * 同步（cloudreveSyncScript）与巡检（cloudreveSyncCheck）共用。
 */
async function collectCloudreveDiff() {
  const items = await searchCloudreveFolders('[vndb-')
  const existing = await getAlistbRows()
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
  description: sql`COALESCE(
    (SELECT kw.intro FROM ${kungalWorks} kw WHERE kw.vndb_id = ${vn.id}),
    ${vn.description}
  )`,
  released_first: sql`COALESCE(
    (SELECT kw.released_first FROM ${kungalWorks} kw WHERE kw.vndb_id = ${vn.id}),
    (SELECT MIN(${releases.released}) FROM ${releasesVn} INNER JOIN ${releases} ON ${releases.id} = ${releasesVn.id} WHERE ${releasesVn.vid} = ${vn.id} AND ${releases.released} IS NOT NULL),
    ''
  )`,
  dl_count: sql`(SELECT COUNT(*)::int FROM ${gameDownloadStats} WHERE game_id = ${vn.id})`,
  vw_count: sql`(SELECT COUNT(*)::int FROM ${eventViews} WHERE event_type = 'game_view' AND target_id = ${vn.id})`,
  titles: sql`COALESCE(
    (SELECT json_agg(kt.title) FROM ${kungalWorkTitles} kt INNER JOIN ${kungalWorks} kw ON kw.id = kt.work_id WHERE kw.vndb_id = ${vn.id})::jsonb,
    '[]'::jsonb
  ) || COALESCE(
    (SELECT json_agg(t.title) FROM ${vnTitles} t WHERE t.id = ${vn.id})::jsonb,
    '[]'::jsonb
  )`,
  tag_names: sql`COALESCE((SELECT json_agg(DISTINCT z.name) FROM ${tagsVn} tv INNER JOIN ${zhtags} z ON tv.tag = z.id WHERE tv.vid = ${vn.id} AND z.exhibition = TRUE), '[]'::json)`,
  tags: sql`COALESCE((SELECT json_agg(DISTINCT tv.tag) FROM ${tagsVn} tv INNER JOIN ${zhtags} z ON tv.tag = z.id WHERE tv.vid = ${vn.id} AND z.exhibition = TRUE), '[]'::json)`,
  titles_obj: sql`COALESCE(
    (SELECT json_agg(row_to_json(kt.*)) FROM (SELECT kt.title, kt.latin, kt.lang FROM ${kungalWorkTitles} kt INNER JOIN ${kungalWorks} kw ON kw.id = kt.work_id WHERE kw.vndb_id = ${vn.id}) kt)::jsonb,
    '[]'::jsonb
  ) || COALESCE(
    (SELECT json_agg(row_to_json(t.*)) FROM (
      SELECT t.title, t.latin, t.lang FROM ${vnTitles} t
      WHERE t.id = ${vn.id}
        AND t.lang NOT IN (
          SELECT kt2.lang FROM ${kungalWorkTitles} kt2
          INNER JOIN ${kungalWorks} kw2 ON kw2.id = kt2.work_id
          WHERE kw2.vndb_id = ${vn.id} AND kt2.lang IS NOT NULL
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
        COALESCE((SELECT c_sexual_avg FROM ${images} i WHERE i.id = ${vn.cImage}), 0) AS c_sexual_avg
      FROM ${kungalWorks} kw
      WHERE kw.vndb_id = ${vn.id} AND kw.cover_url IS NOT NULL
        AND kw.cover_width IS NOT NULL AND kw.cover_height IS NOT NULL
        AND kw.cover_height >= kw.cover_width
    ) kimg),
    (SELECT row_to_json(i.*) FROM (SELECT id, height, width, COALESCE(c_sexual_avg, 0) AS c_sexual_avg FROM ${images} i WHERE i.id = ${vn.cImage}) i)
  )`,
  releases: sql`COALESCE((SELECT json_agg(row_to_json(rel.*)) FROM (SELECT r.title, r.released FROM ${releasesVn} rv INNER JOIN ${releases} r ON r.id = rv.id WHERE rv.vid = ${vn.id}) rel), '[]'::json)`,
  tags_obj: sql`COALESCE((SELECT json_agg(row_to_json(tag.*)) FROM (SELECT DISTINCT z.alias, z.name, z.id FROM ${tagsVn} tv INNER JOIN ${zhtags} z ON tv.tag = z.id WHERE tv.vid = ${vn.id} AND z.exhibition = TRUE) tag), '[]'::json)`,
  has_download: sql`TRUE`,
}

/** Subquery-based columns used when alistb is NOT joined (incremental sync paths). */
const gameMeiliDocOtherSubquery = {
  other: sql`(SELECT ${alistb.other} FROM ${alistb} WHERE ${alistb.vid} = ${vn.id} LIMIT 1)`,
  otherData: sql`(SELECT row_to_json(other_sub.*) FROM (SELECT o.id, a.other_val AS other, o.title, o.alias, COALESCE((SELECT json_agg(row_to_json(om_sub.*)) FROM (SELECT om.*, (SELECT row_to_json(m.*) FROM ${media} m WHERE m.hash = om.media_hash) AS media FROM ${otherMedia} om WHERE om.other_id = o.id) om_sub), '[]'::json) AS other_media FROM ${others} o CROSS JOIN LATERAL (SELECT ${alistb.other} AS other_val FROM ${alistb} WHERE ${alistb.vid} = ${vn.id} LIMIT 1) a WHERE o.id = a.other_val) other_sub)`,
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

/** Add computed imageUrl to each doc's images field using buildCoverUrl. */
function addImageUrlToDocs(docs: Array<Record<string, unknown>>): void {
  for (const doc of docs) {
    const img = doc.images as Record<string, unknown> | null
    if (img?.id) {
      img.imageUrl = buildCoverUrl(
        img.id as string,
        img.width as number,
        img.height as number,
      )
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
      }
      const record: CloudreveSyncStats = {
        lastUpdate: Date.now(),
        ...stats,
        tookMs: Date.now() - startedAt,
      }

      await db.transaction(async (trx) => {
        const CHUNK_SIZE = 500

        // Bulk UPSERT in chunks to avoid N per-row round trips。
        // 仅覆盖 vid/path：保留 existing.other，防止覆盖管理员手工绑定的 other 关联。
        for (let i = 0; i < diff.chunks.length; i += CHUNK_SIZE) {
          const chunk = diff.chunks.slice(i, i + CHUNK_SIZE)
          await trx
            .insert(alistb)
            .values(
              chunk.map((r) => ({
                id: r.id,
                vid: r.vid,
                other: r.other,
                path: r.path,
              })),
            )
            .onConflictDoUpdate({
              target: alistb.id,
              set: {
                vid: sql.raw('excluded.vid'),
                other: sql.raw('galrc_alistb.other'),
                path: sql.raw('excluded.path'),
              },
            })
        }

        // 删除已确认不存在的行（搜索结果缺失且所有存储路径均已验证失效），分块删除
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
      addedRows: diff.addedRows,
      updatedRows: diff.updatedRows,
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
    const results: { vid?: string; other?: string; id: string }[] = []
    const idPattern = /\[(vndb-(v\d+)|other-(\w+))\]/g

    for (const item of alistData) {
      const matches = Array.from(item.name.matchAll(idPattern))
      const record: { vid?: string; other?: string } = {}

      for (const match of matches) {
        if (match[2]) record.vid = match[2] // vndb-vxxx
        if (match[3]) record.other = match[3] // other-xxx
      }

      // 只收集至少有一个字段的项
      if (Object.keys(record).length > 0) {
        let id = ''
        if (record.vid && record.other) {
          id = `${record.vid}-${record.other}`
        } else if (record.vid) {
          id = record.vid
        } else if (record.other) {
          id = record.other
        }
        results.push({ ...record, id })
      }
    }

    return results
  },

  deduplicateResults(
    results: Array<{ vid?: string; other?: string; id: string }>,
  ) {
    const dedupedMap = new Map<
      string,
      { vid?: string; other?: string; id: string }
    >()

    for (const item of results) {
      const key = item.vid || crypto.randomUUID()
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

  async meiliSearchAddIndex() {
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

      // 差集删除：DB 中有文件的 vid（alistb.vid）之外的游戏文档视为过期，分批删除。
      const liveVids = new Set(
        (await db.selectDistinct({ vid: alistb.vid }).from(alistb))
          .map((r) => r.vid)
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

  async meiliSearchAddTag() {
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

  async meiliSearchAddProducer() {
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

const MeiliSearchData = async (pageSize: number, pageIndex: number) => {
  const offset = pageIndex * pageSize

  const items = await db
    .select({
      ...gameMeiliDocBase,
      ...gameMeiliDocOtherDirect,
    })
    .from(alistb)
    .innerJoin(vn, eq(alistb.vid, vn.id))
    .orderBy(desc(vn.id), desc(alistb.other))
    .limit(pageSize)
    .offset(offset)
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
