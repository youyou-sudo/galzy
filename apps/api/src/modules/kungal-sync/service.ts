import {
  alistb,
  db,
  kungalWorks,
  kungalWorkTitles,
  siteConfig,
  sql,
} from '@api/libs'
import { purgeAfterSync } from '@api/libs/cloudflare-cache'
import { linkAliases } from '@api/libs/identity'
import {
  extractVndbRef,
  jsonbArray,
  KungalClient,
  type KungalWorkItem,
  normalizeWork,
  parseRefs,
  refsToAliasPairs,
} from '@api/libs/kungal-api'
import { acquireLockKv, delKvPattern, releaseLockKv } from '@api/libs/redis'
import { CronService } from '@api/modules/cron/service'
import { VndbSync } from '@api/modules/vndb-sync/service'
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm'

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

/** galrc_alistb 锚点行（redirects 收口用）。 */
interface AlistbAnchorRow {
  id: string
  vid: string | null
  anchorKind: string
  kungalId: string | null
  displayId: string
  path: unknown
}

/** redirects 收口计划：先算后写，dryRun 只打印计划。 */
interface RedirectPlan {
  olds: string[]
  target: string
  canonicalId: string
  vndb?: string
  survivor?: AlistbAnchorRow
  victims: AlistbAnchorRow[]
  nextDisplay?: string
  nextKind?: string
  update: boolean
  skip?: string
}

/** delta 同步消费 redirects feed 的结果（仅用于日志）。 */
interface RedirectStats {
  redirects: number
  rowsUpdated: number
  rowsDeleted: number
  aliases: number
  skipped: number
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

  /** full = 全部 alistb 锚点；delta = 新作品及缺少封面尺寸的旧记录。 */
  async runSync(
    type: 'full' | 'delta',
    onProgress?: (processed: number, total: number) => void,
  ) {
    // 两路锚点：① vndb 锚点（走 refs= 批量通道）② 只有 kungal 锚点的条目
    // （走 ids= 批量通道）。后者此前完全没有同步入口 —— 网盘先出现
    // [kungal-X] 目录、目录里又没有 vndb 锚点时，galrc_alistb 有行而
    // galrc_kungal_works 永远缺行，详情页只能渲染空壳（标题 null / 无封面）。
    const vids = await this.getAlistbVids()
    const kungalOnlyIds = await this.getKungalOnlyWorkIds()
    if (vids.length === 0 && kungalOnlyIds.length === 0) {
      // delta 即使没有需要同步的条目，也要消费一次 redirects（合并事件与条目无关）
      if (type === 'delta') await this.consumeRedirects()
      return
    }

    let target = vids
    let kungalTarget = kungalOnlyIds
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

      // kungal-only 通道的增量口径：只要本地已有该 work 行且封面尺寸/thumbhash
      // 齐全就跳过；缺行或数据不全才重新水合（避免每次 delta 全量重刷）。
      const existingKungal = new Map(
        (
          await db
            .select({
              id: kungalWorks.id,
              coverUrl: kungalWorks.coverUrl,
              coverWidth: kungalWorks.coverWidth,
              coverHeight: kungalWorks.coverHeight,
              coverThumbhash: kungalWorks.coverThumbhash,
            })
            .from(kungalWorks)
            .where(
              inArray(
                kungalWorks.id,
                kungalOnlyIds.map((r) => r.kungalId),
              ),
            )
        ).map((r) => [r.id.toLowerCase(), r]),
      )
      kungalTarget = kungalOnlyIds.filter(({ kungalId }) => {
        const row = existingKungal.get(kungalId.toLowerCase())
        if (!row) return true
        const hasCoverDimensions =
          typeof row.coverWidth === 'number' &&
          row.coverWidth > 0 &&
          typeof row.coverHeight === 'number' &&
          row.coverHeight > 0
        const hasThumbhash =
          typeof row.coverThumbhash === 'string' &&
          row.coverThumbhash.length > 0
        const hasCover = row.coverUrl !== null
        return !hasCover || !hasCoverDimensions || !hasThumbhash
      })
    }
    if (target.length === 0 && kungalTarget.length === 0) {
      console.log('🔄 Kungal 增量同步: 无新条目')
      if (type === 'delta') await this.consumeRedirects()
      return
    }

    console.log(
      `🔄 Kungal ${type} 同步开始: ${target.length} 个 VN + ${kungalTarget.length} 个 kungal-only 条目`,
    )
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

    // 阶段 1：两路解析并发
    // ① vndb 锚点 → work（refs= 批量通道 ≤100/次，并发 4）
    // ② kungal-only 锚点 → work（ids= 批量通道；这类条目在网盘里只有
    //    [kungal-X] 目录，从没有 vndb 锚点，此前完全没有同步入口）
    const [resolvedByVndb, resolvedKungalOnly] = await Promise.all([
      KungalClient.resolveWorksByVndbIds(target, (processed) => {
        void this.updateProgress({
          processedItems: processed,
          stage: 'resolve',
        })
        onProgress?.(processed, target.length)
      }),
      KungalClient.resolveWorksByKungalIds(
        kungalTarget.map((r) => r.kungalId),
        (processed) => {
          onProgress?.(processed, kungalTarget.length)
        },
      ),
    ])
    // 统一成 [锚点 vid | null, item]：kungal-only 通道没有 vndb 锚点，传给
    // normalizeWork 的 vid 为 null，vndbId 只由 item.refs 裁定。
    const resolvedEntries: Array<[string | null, KungalWorkItem]> = [
      ...resolvedByVndb.entries(),
      ...[...resolvedKungalOnly.values()].map(
        (item): [string | null, KungalWorkItem] => [null, item],
      ),
    ]
    const resolvedTotal = resolvedEntries.length
    console.log(
      `✅ Kungal 解析完成: ${resolvedTotal}/${target.length + kungalTarget.length}（vndb ${resolvedByVndb.size} + kungal-only ${resolvedKungalOnly.size}）`,
    )
    await this.updateProgress({
      stage: 'works',
      resolvedCount: resolvedTotal,
      processedItems: resolvedTotal,
    })
    await this.addLog(
      'info',
      `解析完成: ${resolvedTotal}/${target.length + kungalTarget.length} 命中（vndb ${resolvedByVndb.size} + kungal-only ${resolvedKungalOnly.size}）`,
    )

    // 阶段 2：批量 upsert（每批 3 条语句：works upsert、titles 清、titles 插）
    // 避免逐行远程事务（远程库单事务 ~2s，815 行会拖到半小时）
    let errors = 0
    let upserted = 0
    let aliases = 0
    const entries = resolvedEntries
    for (let i = 0; i < entries.length; i += RESOLVE_BATCH) {
      const batch = entries.slice(i, i + RESOLVE_BATCH)
      try {
        // vid 为 null 的是 kungal-only 通道（网盘只有 [kungal-X] 目录）：
        // vndbId 只由 refs 裁定，接不到就是纯 kungal 条目。
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
        // 同一个 kungal work.id 可能被两个不同的 vid 解析到（resolved 以 vid 为键，
        // 而 vndbId 用的是各自的请求 vid，所以锚点去重抓不到）。若两条都留下：
        // 1) works 的 `ON CONFLICT (id) DO UPDATE` 会在同一语句内二次命中同一行，
        //    Postgres 直接报 21000 `cannot affect row a second time`；
        // 2) titles 会写入重复的 (work_id, lang, title)，命中唯一索引 23505。
        // 因此这里再按 work.id 去重（保留首条）。
        const seenWorkIds = new Set<string>()
        const kept = normalized.filter(({ work }) => {
          if (seenWorkIds.has(work.id)) {
            console.warn(`⚠️ Kungal work ${work.id} 在本批重复出现，跳过`)
            return false
          }
          const anchor = work.vndbId
          if (!anchor) {
            seenWorkIds.add(work.id)
            return true
          }
          const owner = anchorOwner.get(anchor)
          if (owner !== undefined && owner !== work.id) {
            console.warn(
              `⚠️ Kungal 锚点冲突：work ${work.id} 的 ${anchor} 已被 ${owner} 占用，跳过`,
            )
            return false
          }
          if (seenAnchors.has(anchor)) return false
          seenAnchors.add(anchor)
          seenWorkIds.add(work.id)
          return true
        })
        const works = kept.map(({ work }) => ({
          ...work,
          // refs 必须是「真 jsonb 数组」：直接传数组会被 drizzle 串化 + bun 再编码
          // 成 jsonb 字符串（历史 bug），这里显式走 ::text::jsonb。
          refs: jsonbArray(work.refs),
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

        // 锚点别名（kungal work id + refs 外部锚点 → vndb）：每批一条 upsert。
        // 保证旧 /kgX 链接永久可解析、bangumi/dlsite/… 等外部 id 归一到 vndb；
        // 只登记本批真正落库的 work，失败不影响已提交的 works。
        const aliasPairs = kept.flatMap(({ work }) => {
          if (!work.vndbId) return []
          return [
            {
              kind: 'kungal',
              externalId: work.id,
              canonicalVid: work.vndbId,
            },
            ...refsToAliasPairs(parseRefs(work.refs), work.vndbId),
          ]
        })
        if (aliasPairs.length > 0) {
          try {
            await linkAliases(aliasPairs)
            aliases += aliasPairs.length
          } catch (err) {
            console.error(
              `❌ Kungal alias batch ${i / RESOLVE_BATCH + 1} failed:`,
              err,
            )
          }
        }
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

    // 阶段 2.5（仅 delta）：消费 redirects feed —— kungal 作品被合并时
    // old_id → current_id，收口 alistb 并给旧 id 登记别名，旧链接永不 404。
    if (type === 'delta') await this.consumeRedirects()

    // 阶段 3：缓存与 CDN 失效
    await this.updateProgress({ stage: 'cache' })
    // Meilisearch 的游戏文档也包含封面尺寸，否则搜索页会继续使用旧比例。
    await CronService.syncGameBatchToMeili([...resolvedByVndb.keys()])
    // kungal-only 条目没有 vn 行，走独立的文档通道；否则这次补建出来的
    // work 行只对详情页生效，列表/搜索仍搜不到。
    if (kungalTarget.length > 0) {
      await CronService.syncKungalOnlyBatchToMeili(
        kungalTarget.map((r) => r.displayId),
      )
    }
    await this.invalidateCache()
    await purgeAfterSync()
    await this.updateProgress({
      status: 'completed',
      completedAt: new Date().toISOString(),
      stage: null,
    })
    await this.addLog(
      'success',
      `Kungal ${type} 同步完成: upsert ${upserted}, 失败 ${errors}, 别名 ${aliases}`,
    )
    console.log(
      `✅ Kungal ${type} 同步完成: upsert ${upserted}, 失败 ${errors}, 别名 ${aliases}`,
    )
  },

  /** delta 阶段 2.5 入口：消费 redirects feed；失败只记日志，不打断本次同步。 */
  async consumeRedirects() {
    try {
      const redirects = await this.applyWorkRedirects()
      if (redirects.redirects > 0) {
        await this.addLog(
          'info',
          `redirects: ${redirects.redirects} 个合并，更新 ${redirects.rowsUpdated} 行，删除 ${redirects.rowsDeleted} 行占位，别名 ${redirects.aliases}，跳过 ${redirects.skipped}`,
        )
      }
    } catch (err) {
      console.error('❌ Kungal redirects 消费失败:', err)
      await this.addLog(
        'error',
        `redirects 消费失败: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  },

  /**
   * 消费 catalog redirects feed：kungal 作品合并（old_id → current_id）。
   *
   * 归一口径（见 CONTRACT.md §1/§3）：
   * 1. 传递闭包：feed 可能出现链式合并 A→B、B→C，一律收敛到最终 C；
   * 2. 目标核实：current_id 必须在本地 galrc_kungal_works 或 ids= 水合里存在，
   *    否则整组跳过 —— 不让 kungal_id 指向不存在的作品；
   * 3. alistb 收口：同一目标只留一行，优先保留带 VNDB 锚点的行；要删的占位行
   *    带 path（下载资源）时整组跳过交给人工处理，不静默丢资源；
   * 4. 幸存行原地改 kungal_id；无 VNDB 锚点时 display_id 同步为 kg<current_id>，
   *    有锚点则保持 vNNN（展示身份永不倒退）；
   * 5. old_id 登记 kind='kungal' 别名 → 当前作品的 VNDB 锚点（有锚点才登记）。
   */
  async applyWorkRedirects(options?: {
    dryRun?: boolean
  }): Promise<RedirectStats> {
    const dryRun = options?.dryRun === true
    const stats: RedirectStats = {
      redirects: 0,
      rowsUpdated: 0,
      rowsDeleted: 0,
      aliases: 0,
      skipped: 0,
    }
    const feed = await KungalClient.fetchWorkRedirects()
    if (feed.length === 0) return stats

    // 1) 去重（同一 old_id 多条事件保留 merged_at 最新）+ 传递闭包
    const mergedAt = new Map<string, string>()
    const direct = new Map<string, string>()
    for (const item of feed) {
      const oldId = item.old_id?.trim()
      const currentId = item.current_id?.trim()
      if (!oldId || !currentId || oldId === currentId) continue
      if (item.target_object && item.target_object !== 'work') continue
      const at = item.merged_at ?? ''
      if ((mergedAt.get(oldId) ?? '') > at) continue
      direct.set(oldId, currentId)
      mergedAt.set(oldId, at)
    }
    if (direct.size === 0) return stats

    const finalTarget = (id: string): string => {
      let current = id
      const seen = new Set([current])
      for (let depth = 0; depth < 10; depth++) {
        const next = direct.get(current)
        if (!next || seen.has(next)) break
        seen.add(next)
        current = next
      }
      return current
    }
    const mapping = new Map<string, string>()
    for (const oldId of direct.keys()) {
      const target = finalTarget(oldId)
      if (target !== oldId) mapping.set(oldId, target)
    }
    if (mapping.size === 0) return stats
    stats.redirects = mapping.size

    // 2) 目标 work 核实：本地优先，缺失再走 ids= 批量水合
    const targetIds = [...new Set(mapping.values())]
    const known = new Map<string, string>() // lower(id) → 原样 id
    const vndbOf = new Map<string, string>() // lower(id) → vndb 锚点
    for (const targetId of targetIds)
      known.set(targetId.toLowerCase(), targetId)

    const localWorks = await db
      .select({ id: kungalWorks.id, vndbId: kungalWorks.vndbId })
      .from(kungalWorks)
      .where(inArray(kungalWorks.id, targetIds))
    const localIds = new Set<string>()
    for (const row of localWorks) {
      localIds.add(row.id)
      known.set(row.id.toLowerCase(), row.id)
      if (row.vndbId) vndbOf.set(row.id.toLowerCase(), row.vndbId)
    }
    const missing = targetIds.filter((id) => !localIds.has(id))
    if (missing.length > 0) {
      const hydrated = await KungalClient.resolveWorksByKungalIds(missing)
      for (const [id, item] of hydrated) {
        known.set(id.toLowerCase(), String(item.id))
        const vid = extractVndbRef(item.refs)
        if (vid) vndbOf.set(id.toLowerCase(), vid.toLowerCase())
      }
    }

    // 3) 本地 alistb 锚点行（按 lower(kungal_id) 命中）
    const lowers = [
      ...new Set(
        [...mapping.keys(), ...mapping.values()].map((id) => id.toLowerCase()),
      ),
    ]
    const rows: AlistbAnchorRow[] =
      lowers.length === 0
        ? []
        : await db
            .select({
              id: alistb.id,
              vid: alistb.vid,
              anchorKind: alistb.anchorKind,
              kungalId: alistb.kungalId,
              displayId: alistb.displayId,
              path: alistb.path,
            })
            .from(alistb)
            .where(inArray(sql`lower(${alistb.kungalId})`, lowers))
    const rowById = new Map(rows.map((row) => [row.id, row]))
    const rowByKungal = new Map<string, AlistbAnchorRow>()
    for (const row of rows) {
      if (row.kungalId) rowByKungal.set(row.kungalId.toLowerCase(), row)
    }

    // 4) 分组：同一最终 target 的所有 old_id + 该 target 现有行
    const groups = new Map<
      string,
      { target: string; olds: string[]; rowIds: string[] }
    >()
    for (const [oldId, target] of mapping) {
      const key = target.toLowerCase()
      const group = groups.get(key) ?? { target, olds: [], rowIds: [] }
      group.olds.push(oldId)
      for (const candidate of [oldId, target]) {
        const row = rowByKungal.get(candidate.toLowerCase())
        if (row && !group.rowIds.includes(row.id)) group.rowIds.push(row.id)
      }
      groups.set(key, group)
    }

    // 5) 生成计划（纯内存）：dryRun 只打印；真实执行单事务 + 每组 savepoint，
    //    一组脏数据只回滚自己，不拖垮其余合并。
    const plans: RedirectPlan[] = []
    for (const group of groups.values()) {
      const key = group.target.toLowerCase()
      const canonicalId = known.get(key) ?? group.target
      const base: RedirectPlan = {
        olds: group.olds,
        target: group.target,
        canonicalId,
        vndb: vndbOf.get(key),
        victims: [],
        update: false,
      }
      if (!known.has(key)) {
        plans.push({ ...base, skip: '目标作品不存在' })
        continue
      }
      const groupRows = group.rowIds
        .map((id) => rowById.get(id))
        .filter((row): row is AlistbAnchorRow => row !== undefined)
      if (groupRows.length === 0) {
        plans.push(base)
        continue
      }
      const withVndb = groupRows.filter((row) => row.vid)
      if (withVndb.length > 1) {
        plans.push({ ...base, skip: '多行已有 VNDB 锚点' })
        continue
      }
      const survivor =
        withVndb[0] ??
        groupRows.find((row) => (row.kungalId ?? '').toLowerCase() === key) ??
        groupRows[0]
      const victims = groupRows.filter((row) => row.id !== survivor.id)
      if (victims.some((row) => row.path !== null)) {
        plans.push({ ...base, skip: '冲突占位行带 path' })
        continue
      }
      const nextDisplay = survivor.vid ? survivor.displayId : `kg${canonicalId}`
      const nextKind = survivor.vid ? survivor.anchorKind : 'kungal'
      plans.push({
        ...base,
        survivor,
        victims,
        nextDisplay,
        nextKind,
        update:
          survivor.kungalId !== canonicalId ||
          survivor.displayId !== nextDisplay ||
          survivor.anchorKind !== nextKind,
      })
    }

    // 别名与统计：即使 alistb 收口被跳过，旧 kgX 仍要有别名可解析
    const aliasPairs: Array<{
      kind: string
      externalId: string
      canonicalVid: string
      canonicalKind?: 'vndb' | 'kungal'
    }> = []
    for (const plan of plans) {
      for (const oldId of plan.olds) {
        if (plan.vndb) {
          // 目标作品有 vndb 锚点：旧 kungal id 永久解析到 /vNNN
          aliasPairs.push({
            kind: 'kungal',
            externalId: oldId,
            canonicalVid: plan.vndb,
          })
        } else {
          // 目标作品尚无 vndb 锚点：登记 kungal→kungal 合并，
          // 否则网盘里仍叫 [kungal-旧id] 的目录会解析出与收口行不同的展示身份，
          // 下次扫描就会多出一个重复条目。
          aliasPairs.push({
            kind: 'kungal',
            externalId: oldId,
            canonicalVid: plan.canonicalId,
            canonicalKind: 'kungal',
          })
        }
      }
      if (plan.skip) {
        stats.skipped++
        continue
      }
      stats.rowsDeleted += plan.victims.length
      if (plan.update) stats.rowsUpdated++
    }
    stats.aliases = aliasPairs.length

    if (dryRun) {
      console.log(
        `[redirects dry-run] ${stats.redirects} 个合并 → 更新 ${stats.rowsUpdated} 行、删除 ${stats.rowsDeleted} 行占位、别名 ${stats.aliases}、跳过 ${stats.skipped}`,
      )
      for (const plan of plans.slice(0, 10)) {
        const action = plan.skip
          ? `跳过（${plan.skip}）`
          : plan.survivor
            ? `幸存行 ${plan.survivor.id}`
            : '仅写别名'
        console.log(`  ${plan.olds.join(',')} → ${plan.canonicalId}: ${action}`)
      }
      return stats
    }

    await db.transaction(async (tx) => {
      for (const plan of plans) {
        if (plan.skip || !plan.survivor) continue
        const { survivor } = plan
        try {
          await tx.transaction(async (sp) => {
            for (const victim of plan.victims) {
              await sp.delete(alistb).where(eq(alistb.id, victim.id))
            }
            if (plan.update) {
              await sp
                .update(alistb)
                .set({
                  kungalId: plan.canonicalId,
                  anchorKind: plan.nextKind,
                  displayId: plan.nextDisplay,
                })
                .where(eq(alistb.id, survivor.id))
            }
          })
        } catch (err) {
          // 该组 savepoint 已回滚：撤回预统计，不影响其余组
          stats.rowsDeleted -= plan.victims.length
          if (plan.update) stats.rowsUpdated--
          stats.skipped++
          console.error(
            `❌ Kungal redirect ${plan.olds.join(',')} → ${plan.canonicalId} 收口失败（已回滚该组）:`,
            err,
          )
        }
      }
    })

    if (aliasPairs.length > 0) {
      stats.aliases = aliasPairs.length
      try {
        await linkAliases(aliasPairs)
      } catch (err) {
        stats.aliases = 0
        console.error('❌ Kungal redirects 别名写入失败:', err)
      }
    }
    return stats
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

  /**
   * alistb 中「只有 kungal 锚点」的条目（vid 为空、kungal_id 非空）。
   *
   * 这类行来自网盘里的 `[kungal-X]` 目录：kungal 侧先有作品、VNDB 侧还没有，
   * 或者还接不上 vndb 锚点。它们**不会**出现在 getAlistbVids 里，因此此前
   * 从没被同步过 —— galrc_kungal_works 缺行 → 详情页拿不到标题/封面/简介。
   *
   * 返回去重后的 (kungal work id, 展示身份) 列表，供 ids= 批量通道水合。
   */
  async getKungalOnlyWorkIds(): Promise<
    Array<{ kungalId: string; displayId: string }>
  > {
    const rows = await db
      .select({
        kungalId: alistb.kungalId,
        displayId: alistb.displayId,
      })
      .from(alistb)
      .where(and(isNull(alistb.vid), isNotNull(alistb.kungalId)))
    const out = new Map<string, { kungalId: string; displayId: string }>()
    for (const row of rows) {
      const kungalId = row.kungalId?.trim()
      if (!kungalId) continue
      const key = kungalId.toLowerCase()
      if (!out.has(key)) {
        out.set(key, { kungalId, displayId: row.displayId })
      }
    }
    return [...out.values()]
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
