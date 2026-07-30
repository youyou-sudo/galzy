import {
  alistb,
  cloudflare,
  db,
  eventViews,
  gameDownloadStats,
  images,
  MeiliClient,
  media,
  otherMedia,
  others,
  releases,
  releasesVn,
  siteConfig,
  sql,
  tags,
  tagsVn,
  vn,
  vnTitles,
  zhtags,
} from '@api/libs'
import { purgeByTags } from '@api/libs/cloudflare-cache'

import { acquireLockKv, releaseLockKv } from '@api/libs/redis'
import { VndbSync } from '@api/modules/vndb-sync/service'
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  notInArray,
} from 'drizzle-orm'
import { status } from 'elysia'
import { all } from 'radash'
import { processData } from './lib'

interface MeiliProgress {
  status: 'idle' | 'running' | 'completed' | 'failed'
  type: 'game' | 'tag' | null
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

export const CronService = {
  async workerDataPull() {
    const lockKey = 'galzy:lock:cron:workerDataCorn'
    const lockValue = crypto.randomUUID()
    const lockTimeout = 120000

    const lock = await acquireLockKv(lockKey, lockValue, lockTimeout)
    if (!lock) {
      return
    }

    try {
      const data = await db
        .select({
          id: cloudflare.id,
          accountId: cloudflare.accountId,
          aEmail: cloudflare.aEmail,
          aKey: cloudflare.aKey,
          wokerName: cloudflare.wokerName,
        })
        .from(cloudflare)

      await all(
        data.map(async (item) => {
          try {
            const today = new Date()
            const yyyy = today.getUTCFullYear()
            const mm = String(today.getUTCMonth() + 1).padStart(2, '0')
            const dd = String(today.getUTCDate()).padStart(2, '0')
            const dateStr = `${yyyy}-${mm}-${dd}`

            const raw = JSON.stringify({
              query: `query getBillingMetrics($accountTag: String!, $datetimeStart: String!, $datetimeEnd: String!, $scriptName: String!) { viewer { accounts(filter: {accountTag: $accountTag}) { workersInvocationsAdaptive(limit: 10, filter: { scriptName: $scriptName, date_geq: $datetimeStart, date_leq: $datetimeEnd }) { sum { duration requests subrequests responseBodySize errors }}}}}`,
              variables: {
                accountTag: item.accountId,
                datetimeStart: dateStr,
                datetimeEnd: dateStr,
                scriptName: item.wokerName,
              },
            })

            const commonHeaders = {
              'X-Auth-Email': item.aEmail,
              'X-Auth-Key': item.aKey,
              Accept: '*/*',
              Host: 'api.cloudflare.com',
            }

            // 并行发送两个请求
            const [res, res2] = await Promise.all([
              fetch('https://api.cloudflare.com/client/v4/graphql', {
                method: 'POST',
                headers: {
                  ...commonHeaders,
                  'Content-Type': 'text/plain',
                },
                body: raw,
                redirect: 'follow',
                signal: AbortSignal.timeout(30_000),
              }),
              fetch(
                `https://api.cloudflare.com/client/v4/accounts/${item.accountId}/workers/services/${item.wokerName}/environments/production?expand=routes`,
                {
                  method: 'GET',
                  headers: commonHeaders,
                  signal: AbortSignal.timeout(30_000),
                },
              ),
            ])

            // 并行解析 JSON
            const [json, json2] = await Promise.all([res.json(), res2.json()])

            const result =
              json?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive?.[0]
                ?.sum ?? {}

            const result2 = json2.result.script.routes[0].pattern ?? {}
            const cleanDomain = result2.replace(/\*$/, '').replace(/\/+$/, '')
            const url = `https://${cleanDomain}`

            await db
              .update(cloudflare)
              .set({
                duration: result.duration ?? 0,
                errors: result.errors ?? 0,
                requests: result.requests ?? 0,
                responseBodySize: result.responseBodySize ?? 0,
                subrequests: result.subrequests ?? 0,
                urlEndpoint: url,
                state: (result.requests ?? 0) < 100000,
                updateTime: new Date(),
              })
              .where(eq(cloudflare.id, item.id))
          } catch (err) {
            console.error(`请求失败: ${item.accountId}, ${err}`)
            // 如果请求出错，直接将 state 设置为 false
            await db
              .update(cloudflare)
              .set({
                state: false,
                updateTime: new Date(),
              })
              .where(eq(cloudflare.id, item.id))
          }
        }),
      )
      await releaseLockKv(lockKey, lockValue)
    } catch (err) {
      console.error('workerDataPull 任务失败', err)
      await releaseLockKv(lockKey, lockValue)
    }
  },

  async alistSyncScript() {
    const lockKey = 'galzy:lock:cron:runAlistData'
    const lockValue = crypto.randomUUID()
    const lockTimeout = 120000

    const lock = await acquireLockKv(lockKey, lockValue, lockTimeout)
    if (!lock) return null
    try {
      const [alistUpInfo, alistUpTime] = await Promise.all([
        fetch(`${process.env.OPENLIST_HOST}/api/admin/index/progress`, {
          method: 'GET',
          headers: {
            Authorization: process.env.OPENLIST_API_KEY,
          },
          signal: AbortSignal.timeout(30_000),
        }),
        db
          .select({ config: siteConfig.config })
          .from(siteConfig)
          .where(eq(siteConfig.key, 'alistUpTime'))
          .limit(1)
          .then((r) => r[0]),
      ])

      const alistUp = await alistUpInfo.json()

      if (!alistUp) return
      if (alistUp.is_done === false) return
      const lastUpdate = (
        alistUpTime?.config as { lastUpdate?: number } | undefined
      )?.lastUpdate
      if ((lastUpdate || 0) === alistUp.last_done_time)
        return console.log(
          'alistUp.last_done_time',
          alistUp.last_done_time,
          'alistUpTime.config.lastUpdate',
          lastUpdate,
        )

      const openlistdatas = await fetch(
        `${process.env.OPENLIST_HOST}/api/fs/search`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: process.env.OPENLIST_API_KEY,
          },
          body: JSON.stringify({
            parent: '/',
            keywords: '[vndb-',
            scope: 1,
            page: 1,
            per_page: 1000000,
          }),
          signal: AbortSignal.timeout(30_000),
        },
      )
      const data = (await openlistdatas.json()) as {
        data: {
          content: Array<{
            parent: string
            name: string
            is_dir: boolean
            size: number
            type: number
          }>
        }
      }
      const processedData = processData(data.data.content)

      await db.transaction(async (trx) => {
        const CHUNK_SIZE = 500

        // Bulk UPSERT in chunks to avoid N per-row round trips
        for (let i = 0; i < processedData.length; i += CHUNK_SIZE) {
          const chunk = processedData.slice(i, i + CHUNK_SIZE)
          await trx
            .insert(alistb)
            .values(
              chunk.map((r) => ({
                id: r.id,
                vid: r.vid,
                other: r.other != null ? Number(r.other) : null,
                path: r.path,
              })),
            )
            .onConflictDoUpdate({
              target: alistb.id,
              set: {
                vid: sql.raw('excluded.vid'),
                other: sql.raw('excluded.other'),
                path: sql.raw('excluded.path'),
              },
            })
        }

        // Delete stale entries: fetch existing IDs, diff in-memory, delete in chunks
        const currentIdSet = new Set(processedData.map((r) => r.id))
        const existingIds = await trx
          .select({ id: alistb.id })
          .from(alistb)
          .then((rows) => rows.map((r) => r.id))
        const staleIds = existingIds.filter((id) => !currentIdSet.has(id))
        for (let i = 0; i < staleIds.length; i += CHUNK_SIZE) {
          const chunk = staleIds.slice(i, i + CHUNK_SIZE)
          await trx.delete(alistb).where(inArray(alistb.id, chunk))
        }

        await trx
          .insert(siteConfig)
          .values({
            key: 'alistUpTime',
            config: JSON.stringify({
              lastUpdate: alistUp.last_done_time,
            }),
          })
          .onConflictDoUpdate({
            target: siteConfig.key,
            set: {
              config: JSON.stringify({
                lastUpdate: alistUp.last_done_time,
              }),
            },
          })
      })
      console.log('alistSyncScript 运行成功喵')
      void VndbSync.syncDelta()
      await releaseLockKv(lockKey, lockValue)
    } catch (e) {
      console.error('alistSyncScript 运行失败喵', e)
    } finally {
      await releaseLockKv(lockKey, lockValue)
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
    type: 'game' | 'tag',
    partial: Partial<MeiliProgress>,
  ) {
    const key =
      type === 'game' ? 'meiliSearchProgress_game' : 'meiliSearchProgress_tag'
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

  async getMeiliProgress(type: 'game' | 'tag'): Promise<MeiliProgress> {
    const key =
      type === 'game' ? 'meiliSearchProgress_game' : 'meiliSearchProgress_tag'
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
    type: 'game' | 'tag',
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

      const index = await MeiliClient.index(process.env.MEILISEARCH_INDEXNAME)
      const deleteTask = await index.deleteAllDocuments()
      await MeiliClient.tasks.waitForTask(deleteTask.taskUid, {
        timeout: 300_000,
      })
      await this.addMeiliLog('game', 'info', '已清空现有索引')

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

      await this.updateMeiliProgress('game', {
        status: 'completed',
        completedAt: new Date().toISOString(),
      })
      await this.addMeiliLog('game', 'success', '游戏索引重建完成')
      // Invalidate CDN cache for affected pages
      await purgeByTags(['page-home', 'page-games'])
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
        process.env.MEILISEARCH_TAG_INDEXNAME,
      )
      await index.deleteAllDocuments()
      await this.addMeiliLog('tag', 'info', '已清空现有索引')

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

      await this.updateMeiliProgress('tag', {
        status: 'completed',
        completedAt: new Date().toISOString(),
      })
      await this.addMeiliLog('tag', 'success', '标签索引重建完成')
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

  // Incremental sync: push one VN to Meilisearch by ID
  async syncGameToMeili(vnId: string) {
    const index = MeiliClient.index(
      process.env.MEILISEARCH_INDEXNAME || 'galzy_games',
    )
    try {
      // Query for the specific VN directly
      // MeiliSearchData queries via alistb JOIN vn — we need a single-doc query
      // Re-query for the specific VN
      const doc = await db
        .select({
          id: vn.id,
          alias: vn.alias,
          olang: vn.olang,
          devstatus: vn.devstatus,
          rating: vn.cRating,
          votecount: vn.cVotecount,
          description: vn.description,
          released_first: sql`COALESCE((SELECT MIN(${releases.released}) FROM ${releasesVn} INNER JOIN ${releases} ON ${releases.id} = ${releasesVn.id} WHERE ${releasesVn.vid} = ${vn.id} AND ${releases.released} IS NOT NULL), '')`,
          dl_count: sql`(SELECT COUNT(*)::int FROM ${gameDownloadStats} WHERE game_id = ${vn.id})`,
          vw_count: sql`(SELECT COUNT(*)::int FROM ${eventViews} WHERE event_type = 'game_view' AND target_id = ${vn.id})`,
          titles: sql`COALESCE((SELECT json_agg(t.title) FROM ${vnTitles} t WHERE t.id = ${vn.id}), '[]'::json)`,
          tag_names: sql`COALESCE((SELECT json_agg(DISTINCT z.name) FROM ${tagsVn} tv INNER JOIN ${zhtags} z ON tv.tag = z.id WHERE tv.vid = ${vn.id} AND z.exhibition = TRUE), '[]'::json)`,
          tags: sql`COALESCE((SELECT json_agg(DISTINCT tv.tag) FROM ${tagsVn} tv INNER JOIN ${zhtags} z ON tv.tag = z.id WHERE tv.vid = ${vn.id} AND z.exhibition = TRUE), '[]'::json)`,
          titles_obj: sql`COALESCE((SELECT json_agg(row_to_json(t.*)) FROM (SELECT title, latin, lang FROM ${vnTitles} t WHERE t.id = ${vn.id}) t), '[]'::json)`,
          images: sql`(SELECT row_to_json(i.*) FROM (SELECT id, height, width, COALESCE(c_sexual_avg, 0) AS c_sexual_avg FROM ${images} i WHERE i.id = ${vn.cImage}) i)`,
          other: sql`(SELECT ${alistb.other} FROM ${alistb} WHERE ${alistb.vid} = ${vn.id} LIMIT 1)`,
          otherData: sql`(SELECT row_to_json(other_sub.*) FROM (SELECT o.id, a.other_val AS other, o.title, o.alias, COALESCE((SELECT json_agg(row_to_json(om_sub.*)) FROM (SELECT om.*, (SELECT row_to_json(m.*) FROM ${media} m WHERE m.hash = om.media_hash) AS media FROM ${otherMedia} om WHERE om.other_id = o.id) om_sub), '[]'::json) AS other_media FROM ${others} o CROSS JOIN LATERAL (SELECT ${alistb.other} AS other_val FROM ${alistb} WHERE ${alistb.vid} = ${vn.id} LIMIT 1) a WHERE o.id = a.other_val) other_sub)`,
          has_download: sql`TRUE`,
        })
        .from(vn)
        .where(eq(vn.id, vnId))
        .limit(1)

      if (doc.length > 0 && doc[0]) {
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
      // Query all VNs in the batch with the same shape as MeiliSearchData
      const docs = await db
        .select({
          id: vn.id,
          alias: vn.alias,
          olang: vn.olang,
          devstatus: vn.devstatus,
          rating: vn.cRating,
          votecount: vn.cVotecount,
          description: vn.description,
          released_first: sql`COALESCE((SELECT MIN(${releases.released}) FROM ${releasesVn} INNER JOIN ${releases} ON ${releases.id} = ${releasesVn.id} WHERE ${releasesVn.vid} = ${vn.id} AND ${releases.released} IS NOT NULL), '')`,
          dl_count: sql`(SELECT COUNT(*)::int FROM ${gameDownloadStats} WHERE game_id = ${vn.id})`,
          vw_count: sql`(SELECT COUNT(*)::int FROM ${eventViews} WHERE event_type = 'game_view' AND target_id = ${vn.id})`,
          titles: sql`COALESCE((SELECT json_agg(t.title) FROM ${vnTitles} t WHERE t.id = ${vn.id}), '[]'::json)`,
          tag_names: sql`COALESCE((SELECT json_agg(DISTINCT z.name) FROM ${tagsVn} tv INNER JOIN ${zhtags} z ON tv.tag = z.id WHERE tv.vid = ${vn.id} AND z.exhibition = TRUE), '[]'::json)`,
          tags: sql`COALESCE((SELECT json_agg(DISTINCT tv.tag) FROM ${tagsVn} tv INNER JOIN ${zhtags} z ON tv.tag = z.id WHERE tv.vid = ${vn.id} AND z.exhibition = TRUE), '[]'::json)`,
          titles_obj: sql`COALESCE((SELECT json_agg(row_to_json(t.*)) FROM (SELECT title, latin, lang FROM ${vnTitles} t WHERE t.id = ${vn.id}) t), '[]'::json)`,
          images: sql`(SELECT row_to_json(i.*) FROM (SELECT id, height, width, COALESCE(c_sexual_avg, 0) AS c_sexual_avg FROM ${images} i WHERE i.id = ${vn.cImage}) i)`,
          releases: sql`COALESCE((SELECT json_agg(row_to_json(rel.*)) FROM (SELECT r.title, r.released FROM ${releasesVn} rv INNER JOIN ${releases} r ON r.id = rv.id WHERE rv.vid = ${vn.id}) rel), '[]'::json)`,
          other: sql`(SELECT ${alistb.other} FROM ${alistb} WHERE ${alistb.vid} = ${vn.id} LIMIT 1)`,
          otherData: sql`(SELECT row_to_json(other_sub.*) FROM (SELECT o.id, a.other_val AS other, o.title, o.alias, COALESCE((SELECT json_agg(row_to_json(om_sub.*)) FROM (SELECT om.*, (SELECT row_to_json(m.*) FROM ${media} m WHERE m.hash = om.media_hash) AS media FROM ${otherMedia} om WHERE om.other_id = o.id) om_sub), '[]'::json) AS other_media FROM ${others} o CROSS JOIN LATERAL (SELECT ${alistb.other} AS other_val FROM ${alistb} WHERE ${alistb.vid} = ${vn.id} LIMIT 1) a WHERE o.id = a.other_val) other_sub)`,
          tags_obj: sql`COALESCE((SELECT json_agg(row_to_json(tag.*)) FROM (SELECT DISTINCT z.alias, z.name, z.id FROM ${tagsVn} tv INNER JOIN ${zhtags} z ON tv.tag = z.id WHERE tv.vid = ${vn.id} AND z.exhibition = TRUE) tag), '[]'::json)`,
          has_download: sql`TRUE`,
        })
        .from(vn)
        .where(inArray(vn.id, vnIds))

      if (docs.length > 0) {
        await index.updateDocuments(docs, { primaryKey: 'id' })
        console.log(`[Meili] 批量增量更新: ${docs.length} docs`)
      }
    } catch (e) {
      console.error(`[Meili] 批量增量更新失败:`, e)
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
}

const MeiliSearchData = async (pageSize: number, pageIndex: number) => {
  const offset = pageIndex * pageSize

  const items = await db
    .select({
      id: vn.id,
      alias: vn.alias,
      olang: vn.olang,
      devstatus: vn.devstatus,
      rating: vn.cRating,
      votecount: vn.cVotecount,
      description: vn.description,
      // Sortable — first release date as text (YYYY-MM-DD, handles partial dates)
      released_first: sql`COALESCE((SELECT MIN(${releases.released}) FROM ${releasesVn} INNER JOIN ${releases} ON ${releases.id} = ${releasesVn.id} WHERE ${releasesVn.vid} = ${vn.id} AND ${releases.released} IS NOT NULL), '')`,
      // Sortable — download and view counts
      dl_count: sql`(SELECT COUNT(*)::int FROM ${gameDownloadStats} WHERE game_id = ${vn.id})`,
      vw_count: sql`(SELECT COUNT(*)::int FROM ${eventViews} WHERE event_type = 'game_view' AND target_id = ${vn.id})`,
      // Searchable — array of title strings
      titles: sql`COALESCE((SELECT json_agg(t.title) FROM ${vnTitles} t WHERE t.id = ${vn.id}), '[]'::json)`,
      // Searchable — array of tag names
      tag_names: sql`COALESCE((SELECT json_agg(DISTINCT z.name) FROM ${tagsVn} tv INNER JOIN ${zhtags} z ON tv.tag = z.id WHERE tv.vid = ${vn.id} AND z.exhibition = TRUE), '[]'::json)`,
      // Filterable — array of tag IDs
      tags: sql`COALESCE((SELECT json_agg(DISTINCT tv.tag) FROM ${tagsVn} tv INNER JOIN ${zhtags} z ON tv.tag = z.id WHERE tv.vid = ${vn.id} AND z.exhibition = TRUE), '[]'::json)`,
      // Display — titles as objects (for UI)
      titles_obj: sql`COALESCE((SELECT json_agg(row_to_json(t.*)) FROM (SELECT title, latin, lang FROM ${vnTitles} t WHERE t.id = ${vn.id}) t), '[]'::json)`,
      // Display — image data
      images: sql`(SELECT row_to_json(i.*) FROM (SELECT id, height, width, COALESCE(c_sexual_avg, 0) AS c_sexual_avg FROM ${images} i WHERE i.id = ${vn.cImage}) i)`,
      // Display — releases
      releases: sql`COALESCE((SELECT json_agg(row_to_json(rel.*)) FROM (SELECT r.title, r.released FROM ${releasesVn} rv INNER JOIN ${releases} r ON r.id = rv.id WHERE rv.vid = ${vn.id}) rel), '[]'::json)`,
      // Display — other data from alistb
      other: alistb.other,
      otherData: sql`(SELECT row_to_json(other_sub.*) FROM (SELECT o.id, ${alistb.other} AS other, o.title, o.alias, COALESCE((SELECT json_agg(row_to_json(om_sub.*)) FROM (SELECT om.*, (SELECT row_to_json(m.*) FROM ${media} m WHERE m.hash = om.media_hash) AS media FROM ${otherMedia} om WHERE om.other_id = o.id) om_sub), '[]'::json) AS other_media FROM ${others} o WHERE o.id = ${alistb.other}) other_sub)`,
      // Display — tag objects
      tags_obj: sql`COALESCE((SELECT json_agg(row_to_json(tag.*)) FROM (SELECT DISTINCT z.alias, z.name, z.id FROM ${tagsVn} tv INNER JOIN ${zhtags} z ON tv.tag = z.id WHERE tv.vid = ${vn.id} AND z.exhibition = TRUE) tag), '[]'::json)`,
      has_download: sql`TRUE`,
    })
    .from(alistb)
    .innerJoin(vn, eq(alistb.vid, vn.id))
    .orderBy(desc(vn.id), desc(alistb.other))
    .limit(pageSize)
    .offset(offset)

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
