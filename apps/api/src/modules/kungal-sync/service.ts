import {
  alistb,
  db,
  kungalWorks,
  kungalWorkTitles,
  siteConfig,
  sql,
} from '@api/libs'
import { purgeAfterSync } from '@api/libs/cloudflare-cache'
import { KungalClient, normalizeWork } from '@api/libs/kungal-api'
import { acquireLockKv, delKvPattern, releaseLockKv } from '@api/libs/redis'
import { CronService } from '@api/modules/cron/service'
import { VndbSync } from '@api/modules/vndb-sync/service'
import { eq, inArray, isNotNull } from 'drizzle-orm'

const RESOLVE_BATCH = 100

let _progressCache: KungalSyncProgress | null = null

export interface KungalSyncProgress {
  status: 'idle' | 'running' | 'completed' | 'failed'
  type: 'full' | 'delta' | null
  startedAt: string | null
  completedAt: string | null
  stage: 'resolve' | 'works' | 'cache' | null
  totalItems: number
  processedItems: number
  errors: number
  resolvedCount: number
  logs: Array<{
    time: string
    level: 'info' | 'error' | 'success'
    message: string
  }>
  lastUpdated: string
}

const IDLE_PROGRESS: KungalSyncProgress = {
  status: 'idle',
  type: null,
  startedAt: null,
  completedAt: null,
  stage: null,
  totalItems: 0,
  processedItems: 0,
  errors: 0,
  resolvedCount: 0,
  logs: [],
  lastUpdated: new Date().toISOString(),
}

export const KungalSync = {
  async syncFull(onProgress?: (processed: number, total: number) => void) {
    const lockKey = 'kungal-sync-full'
    const lockVal = crypto.randomUUID()
    if (!(await acquireLockKv(lockKey, lockVal, 3600_000))) return
    try {
      await this.runSync('full', onProgress)
    } finally {
      await releaseLockKv(lockKey, lockVal)
    }
  },

  async syncDelta(onProgress?: (processed: number, total: number) => void) {
    const lockKey = 'kungal-sync-delta'
    const lockVal = crypto.randomUUID()
    if (!(await acquireLockKv(lockKey, lockVal, 600_000))) return
    try {
      await this.runSync('delta', onProgress)
    } finally {
      await releaseLockKv(lockKey, lockVal)
    }
  },

  /** full = 全部 alistb vid；delta = 新作品及缺少封面尺寸的旧记录。 */
  async runSync(
    type: 'full' | 'delta',
    onProgress?: (processed: number, total: number) => void,
  ) {
    const vids = await this.getAlistbVids()
    if (vids.length === 0) return

    let target = vids
    if (type === 'delta') {
      const existing = new Map(
        (
          await db
            .select({
              vndbId: kungalWorks.vndbId,
              coverUrl: kungalWorks.coverUrl,
              coverWidth: kungalWorks.coverWidth,
              coverHeight: kungalWorks.coverHeight,
              coverThumbhash: kungalWorks.coverThumbhash,
            })
            .from(kungalWorks)
            .where(isNotNull(kungalWorks.vndbId))
        ).map((r) => [r.vndbId as string, r]),
      )
      target = vids.filter((v) => {
        const row = existing.get(v)
        const hasCoverDimensions =
          typeof row?.coverWidth === 'number' &&
          row.coverWidth > 0 &&
          typeof row.coverHeight === 'number' &&
          row.coverHeight > 0
        const hasThumbhash =
          typeof row?.coverThumbhash === 'string' &&
          row.coverThumbhash.length > 0
        return (
          !row ||
          (row.coverUrl !== null && (!hasCoverDimensions || !hasThumbhash))
        )
      })
    }
    if (target.length === 0) {
      console.log('🔄 Kungal 增量同步: 无新 VN')
      return
    }

    console.log(`🔄 Kungal ${type} 同步开始: ${target.length} 个 VN`)
    await this.updateProgress({
      status: 'running',
      type,
      startedAt: new Date().toISOString(),
      completedAt: null,
      stage: 'resolve',
      totalItems: target.length,
      processedItems: 0,
      errors: 0,
      resolvedCount: 0,
      logs: [
        {
          time: new Date().toISOString(),
          level: 'info',
          message: `${type === 'full' ? '全量' : '增量'}同步开始: ${target.length} 个 VN`,
        },
      ],
    })

    // 阶段 1：vndb 锚点 → kungal work 解析（refs= 批量通道 ≤100/次，并发 4）
    const resolved = await KungalClient.resolveWorksByVndbIds(
      target,
      (processed) => {
        void this.updateProgress({
          processedItems: processed,
          stage: 'resolve',
        })
        onProgress?.(processed, target.length)
      },
    )
    console.log(`✅ Kungal 解析完成: ${resolved.size}/${target.length}`)
    await this.updateProgress({
      stage: 'works',
      resolvedCount: resolved.size,
      processedItems: resolved.size,
    })
    await this.addLog(
      'info',
      `解析完成: ${resolved.size}/${target.length} 命中`,
    )

    // 阶段 2：批量 upsert（每批 3 条语句：works upsert、titles 清、titles 插）
    // 避免逐行远程事务（远程库单事务 ~2s，815 行会拖到半小时）
    let errors = 0
    let upserted = 0
    const entries = [...resolved.entries()]
    for (let i = 0; i < entries.length; i += RESOLVE_BATCH) {
      const batch = entries.slice(i, i + RESOLVE_BATCH)
      try {
        const normalized = batch.map(([vid, item]) => normalizeWork(item, vid))

        // galrc_kungal_works.vndb_id 上有唯一索引（见迁移 0021）：同一 VNDB 锚点
        // 只允许一行。若本批某个 work 与库中另一 work 共用锚点，直接 upsert 会抛
        // 23505 让整批失败；先把这类冲突条目剔除（保留库中已有行），并做批内锚点
        // 去重，避免一条脏数据拖垮整批同步。
        const anchors = normalized
          .map(({ work }) => work.vndbId)
          .filter((v): v is string => v !== null)
        const anchorOwner = new Map<string, string>()
        if (anchors.length > 0) {
          const existing = await db
            .select({ id: kungalWorks.id, vndbId: kungalWorks.vndbId })
            .from(kungalWorks)
            .where(inArray(kungalWorks.vndbId, anchors))
          for (const row of existing) {
            if (row.vndbId) anchorOwner.set(row.vndbId, row.id)
          }
        }
        const seenAnchors = new Set<string>()
        const kept = normalized.filter(({ work }) => {
          const anchor = work.vndbId
          if (!anchor) return true
          const owner = anchorOwner.get(anchor)
          if (owner !== undefined && owner !== work.id) {
            console.warn(
              `⚠️ Kungal 锚点冲突：work ${work.id} 的 ${anchor} 已被 ${owner} 占用，跳过`,
            )
            return false
          }
          if (seenAnchors.has(anchor)) return false
          seenAnchors.add(anchor)
          return true
        })
        const works = kept.map(({ work }) => ({
          ...work,
          syncedAt: new Date(),
        }))
        const titles = kept.flatMap(({ titles }) => titles)
        const batchIds = kept.map(({ work }) => work.id)
        if (works.length > 0) {
          await db.transaction(async (tx) => {
            await tx
              .insert(kungalWorks)
              .values(works)
              .onConflictDoUpdate({
                target: kungalWorks.id,
                set: {
                  vndbId: sql`excluded.vndb_id`,
                  olang: sql`excluded.olang`,
                  medium: sql`excluded.medium`,
                  contentRating: sql`excluded.content_rating`,
                  releasedFirst: sql`excluded.released_first`,
                  displayName: sql`excluded.display_name`,
                  coverUrl: sql`excluded.cover_url`,
                  coverWidth: sql`excluded.cover_width`,
                  coverHeight: sql`excluded.cover_height`,
                  coverThumbhash: sql`excluded.cover_thumbhash`,
                  intro: sql`excluded.intro`,
                  localized: sql`excluded.localized`,
                  covers: sql`excluded.covers`,
                  intros: sql`excluded.intros`,
                  ratings: sql`excluded.ratings`,
                  refs: sql`excluded.refs`,
                  syncedAt: sql`excluded.synced_at`,
                },
              })
            await tx
              .delete(kungalWorkTitles)
              .where(inArray(kungalWorkTitles.workId, batchIds))
            if (titles.length > 0)
              await tx.insert(kungalWorkTitles).values(titles)
          })
        }
        upserted += works.length
      } catch (err) {
        errors += batch.length
        console.error(
          `❌ Kungal upsert batch ${i / RESOLVE_BATCH + 1} failed:`,
          err,
        )
      }
      await this.updateProgress({
        stage: 'works',
        processedItems: upserted + errors,
        errors,
      })
      onProgress?.(upserted + errors, entries.length)
      await this.addLog(
        'info',
        `works batch ${Math.min(i + RESOLVE_BATCH, entries.length)}/${entries.length} done`,
      )
    }

    // 阶段 3：缓存与 CDN 失效
    await this.updateProgress({ stage: 'cache' })
    // Meilisearch 的游戏文档也包含封面尺寸，否则搜索页会继续使用旧比例。
    await CronService.syncGameBatchToMeili([...resolved.keys()])
    await this.invalidateCache()
    await purgeAfterSync()
    await this.updateProgress({
      status: 'completed',
      completedAt: new Date().toISOString(),
      stage: null,
    })
    await this.addLog(
      'success',
      `Kungal ${type} 同步完成: upsert ${upserted}, 失败 ${errors}`,
    )
    console.log(
      `✅ Kungal ${type} 同步完成: upsert ${upserted}, 失败 ${errors}`,
    )
  },

  // ========== Progress Tracking ==========

  async updateProgress(partial: Partial<KungalSyncProgress>) {
    _progressCache ??= await this.getProgress()
    const updated: KungalSyncProgress = {
      ..._progressCache,
      ...partial,
      lastUpdated: new Date().toISOString(),
    }
    _progressCache = updated
    await db
      .insert(siteConfig)
      .values({ key: 'kungalSyncProgress', config: updated as any })
      .onConflictDoUpdate({
        target: siteConfig.key,
        set: { config: updated as any },
      })
  },

  async getProgress(): Promise<KungalSyncProgress> {
    const row = await db
      .select({ config: siteConfig.config })
      .from(siteConfig)
      .where(eq(siteConfig.key, 'kungalSyncProgress'))
      .limit(1)
    return (row[0]?.config as KungalSyncProgress | undefined) ?? IDLE_PROGRESS
  },

  async addLog(level: KungalSyncProgress['logs'][0]['level'], message: string) {
    const current = await this.getProgress()
    const logs = [
      ...current.logs,
      { time: new Date().toISOString(), level, message },
    ].slice(-100)
    await this.updateProgress({ logs })
  },

  // ========== Helpers ==========

  /** alistb 中 VNDB 锚点 vid（'v…' 前缀；'d…' 等其它前缀走 vndb 兜底不解析）。 */
  async getAlistbVids(): Promise<string[]> {
    const rows = await db
      .selectDistinct({ vid: alistb.vid })
      .from(alistb)
      .where(isNotNull(alistb.vid))
    return rows.map((r) => r.vid!).filter((v) => /^v\d+$/i.test(v))
  },

  /** 复用 VNDB 同步的缓存失效键集（games 读侧缓存） + kungal 专属键。 */
  async invalidateCache() {
    await VndbSync.invalidateCache()
    await delKvPattern('galzy:kungal:*').catch((e) =>
      console.warn('[Cache] kungal cache invalidation failed:', e),
    )
    await delKvPattern('galzy:views:hot:*').catch((e) =>
      console.warn('[Cache] hot views invalidation failed:', e),
    )
  },
}
