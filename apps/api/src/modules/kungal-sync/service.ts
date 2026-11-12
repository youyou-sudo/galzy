import {
  alistb,
  db,
  forwardTaskLogs,
  kungalCharacterAppearances,
  kungalCharacters,
  kungalWalkthroughs,
  kungalWorks,
  kungalWorkTitles,
  siteConfig,
  sql,
} from '@api/libs'
import { purgeAfterSync } from '@api/libs/cloudflare-cache'
import { linkAliases } from '@api/libs/identity'
import {
  assertKungalKey,
  extractVndbRef,
  jsonbArray,
  type KungalAppearanceRow,
  type KungalCharacterItem,
  type KungalCharacterRow,
  KungalClient,
  type KungalWalkthrough,
  type KungalWalkthroughChart,
  type KungalWalkthroughRow,
  type KungalWorkCharacter,
  type KungalWorkItem,
  kungalRatePerMin,
  normalizeAppearance,
  normalizeCharacter,
  normalizeCharacterFromRoster,
  normalizeWalkthrough,
  normalizeWork,
  parseRefs,
  refsToAliasPairs,
} from '@api/libs/kungal-api'
import {
  acquireLockKv,
  isLockHeldKv,
  isRedisEnabled,
  releaseLockKv,
  renewLockKv,
} from '@api/libs/redis'
import { CronService } from '@api/modules/cron/service'
import { and, eq, inArray, isNotNull, isNull, notInArray } from 'drizzle-orm'

const RESOLVE_BATCH = 100
/** 角色阶段每个事务处理的作品数（每作品名册 1..N 次请求，水合按 100/次）。 */
const CHARACTER_WORK_BATCH = 10
/** delta 每次最多补多少个「还没有名册行」的存量作品（避免每轮都扫全表）。 */
const DELTA_CHARACTER_BACKFILL = 200
/** 攻略 ids= 批量刷新的每批 id 数（API 批量车道上限 100）。 */
const WALKTHROUGH_ID_BATCH = 100
/** 攻略 upsert 每批行数（chart 单行可达几十 KB，太大的一次语句会拖慢远程事务）。 */
const WALKTHROUGH_UPSERT_BATCH = 100
/** 攻略详情（chart）并发批大小；客户端另有 300 次/分 令牌桶兜底。 */
const WALKTHROUGH_DETAIL_BATCH = 10
/** 本地攻略行按作品 id 查询的分片大小（inArray 参数过多会拖慢解析）。 */
const WALKTHROUGH_LOCAL_BATCH = 500
/** 上游已下线行的删除分片大小。 */
const WALKTHROUGH_DELETE_BATCH = 500

/**
 * 攻略 upsert 的 set 子句。
 *
 * 拆成两份：只有拿到 chart 的那批才写 chart 列。否则「只拿到列表行」的一批
 * 会把库里已有的整棵选择图覆盖成 NULL —— 那是详情请求失败最贵的代价。
 */
const WALKTHROUGH_UPSERT_SET = {
  workId: sql`excluded.work_id`,
  lang: sql`excluded.lang`,
  source: sql`excluded.source`,
  sourceUrl: sql`excluded.source_url`,
  sourceAuthor: sql`excluded.source_author`,
  sourceUpdatedOn: sql`excluded.source_updated_on`,
  workContentLimit: sql`excluded.work_content_limit`,
  workRouteHints: sql`excluded.work_route_hints`,
  release: sql`excluded.release`,
  characters: sql`excluded.characters`,
  endingCount: sql`excluded.ending_count`,
  saveCount: sql`excluded.save_count`,
  segmentCount: sql`excluded.segment_count`,
  upstreamUpdatedAt: sql`excluded.upstream_updated_at`,
  syncedAt: sql`excluded.synced_at`,
}

const WALKTHROUGH_UPSERT_SET_WITH_CHART = {
  ...WALKTHROUGH_UPSERT_SET,
  chart: sql`excluded.chart`,
}
/** delta 每次最多补多少个「完全没有任何攻略行」的存量作品（同角色的口径）。 */
const DELTA_WALKTHROUGH_BACKFILL = 200

/**
 * jsonb 列写入表达式（null 透传）。
 *
 * 与 works.refs 同一个原因：把数组/对象直接交给 drizzle+bun 会被二次编码成
 * jsonb 字符串（见 jsonbArray 注释）。角色表的 jsonb 列（localized /
 * measurements / traits / intros / refs / image / figure）统一走显式
 * text → jsonb，保证列里落的是真 jsonb 数组/对象（jsonb_typeof 可断言），
 * 也让以后按 traits 做 SQL 过滤时不必先解一层字符串。
 * null 必须原样透传：jsonbArray 会把 null 变成 []，那会把「没有数据」
 * 表达成「空数组」，读侧无法区分。
 */
function jsonbTextOrNull(value: unknown): unknown {
  return value === null || value === undefined ? null : jsonbArray(value)
}

/**
 * 全量 / 角色 / 攻略阶段的锁 TTL 基数。
 *
 * 不是「任务最长耗时」而是「心跳续期的兜底」：进程活着时 withSyncLock 每 60s
 * 续一次，跑十几小时也不会掉；进程被 kill 后最长等这一个 TTL 就能有人接手。
 */
const LOCK_TTL_LONG_MS = 3600_000
/** 增量同步锁 TTL 基数：只处理新条目，正常几分钟内结束。 */
const LOCK_TTL_DELTA_MS = 600_000

/** 四个同步锁键（withSyncLock 的 lockKey 全集，对账要逐个查是否还有持有者）。 */
const SYNC_LOCK_KEYS = [
  'kungal-sync-full',
  'kungal-sync-delta',
  'kungal-sync-characters',
  'kungal-sync-walkthroughs',
] as const

/**
 * 进度「假运行中」的判定阈值：lastUpdated 比这更旧，才认为写进度的进程不在了。
 *
 * 宁可判晚不判早：同步过程中也有几十秒不写进度的时段（一批作品要跑 30s–8min），
 * 判早了会把正在跑的同步误标成 failed。
 */
const STALE_PROGRESS_MS = 120_000

/**
 * 带分布式锁跑一轮同步。
 *
 * 四个入口（full / delta / characters / walkthroughs）原本各自抄了一份
 *「取锁 → try → catch 收尾 failed → finally 放锁」，任何一处漏掉 finally 都会
 * 让锁挂到 TTL 过期；收敛成一处后，锁的生命周期只在这里维护。
 *
 * 锁被占用时返回 undefined 而不是抛错：这是既有契约 —— 队列 worker 把抛错当
 * 任务失败并重试，而「已有一轮在跑」是正常情况（管理端连点、定时任务撞车）。
 *
 * options.failureLog 非空时才会做失败收尾（full/delta 原本就没有这一段：
 * 它们失败时由 runSync 自己在进度里收尾）。
 */
async function withSyncLock(
  lockKey: string,
  ttlMs: number,
  run: () => Promise<void>,
  options?: { failureLog?: string },
): Promise<void> {
  const lockVal = crypto.randomUUID()
  if (!(await acquireLockKv(lockKey, lockVal, ttlMs))) {
    // 锁被占用是「已有一轮在跑」而不是失败（见上面的契约），但必须留下痕迹：
    // 队列任务会显示成功，没有日志的话运维分不清「跑完了」和「根本没跑」。
    const message = `${lockKey} 仍被占用，本轮跳过（可能已有同步在跑）`
    console.log(`⚠️ Kungal ${message}`)
    await KungalSync.addLog('info', message)
    return
  }
  // 心跳续期：TTL 只是「进程死后多久能接手」的上限，不等于任务最长耗时。
  // 按 TTL/3 续（1h → 20min、10min → 200s），比固定 60s 更贴合各入口的实际
  // 预算，也不会对短任务白跑一堆定时器。
  // unref() 让续期定时器不阻止进程退出：CLI 脚本跑完就该能直接结束。
  const heartbeat = setInterval(
    () => {
      void renewLockKv(lockKey, lockVal, ttlMs).then((ok) => {
        // 续期失败只 warn：锁丢了顶多是下一次同步可能撞车，但绝不能因此打断
        // 已经在跑的同步（它可能已经写了半张表）。
        if (!ok && isRedisEnabled) {
          console.warn(
            `⚠️ Kungal ${lockKey} 续期失败：锁已不归本进程，另一轮同步可能已开始`,
          )
        }
      })
    },
    Math.floor(ttlMs / 3),
  )
  heartbeat.unref?.()
  try {
    await run()
  } catch (err) {
    if (options?.failureLog) {
      // 整体失败（kungal 不可达 / DB 连不上）：把进度收尾成 failed，
      // 否则管理页会一直停在「运行中」。
      await KungalSync.updateProgress({
        status: 'failed',
        stage: null,
        completedAt: new Date().toISOString(),
      })
      await KungalSync.addLog(
        'error',
        `${options.failureLog}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
    throw err
  } finally {
    // 先停心跳再放锁：反过来的话，放锁后到 clearInterval 之间还会续一次，
    // 那次 GET==val 已经失败（键已删），只会白打一条 warn。
    clearInterval(heartbeat)
    await releaseLockKv(lockKey, lockVal)
  }
}

/** 角色 / 攻略两个「附加数据阶段」的差异点（其余收尾逻辑完全同构）。 */
interface StageSpec {
  stage: 'characters' | 'walkthroughs'
  /** 进度里的 type 值（standalone 轮次用它标识「只跑这个阶段」）。 */
  type: 'characters' | 'walkthroughs'
  /**
   * 中文日志前缀，'角色' / '攻略'。**不要改动**：运维按日志字符串 grep
   * （`角色阶段完成` / ✅ Kungal 攻略阶段完成 都是被脚本消费的）。
   */
  label: string
  /** 阶段开始时清零的计数（各阶段字段不同，故由 spec 提供）。 */
  reset: (total: number) => Partial<KungalSyncProgress>
}

const CHARACTER_STAGE: StageSpec = {
  stage: 'characters',
  type: 'characters',
  label: '角色',
  reset: (total) => ({
    characterTotal: total,
    charactersUpserted: 0,
    appearancesUpserted: 0,
  }),
}

const WALKTHROUGH_STAGE: StageSpec = {
  stage: 'walkthroughs',
  type: 'walkthroughs',
  label: '攻略',
  reset: (total) => ({
    walkthroughTotal: total,
    walkthroughsUpserted: 0,
    walkthroughDetails: 0,
    walkthroughsRemoved: 0,
  }),
}

/**
 * 阶段开始时的进度重置。
 *
 * standalone（管理端单独触发该阶段）时顺便把整轮状态改成 running 并清零
 * errors；作为 full/delta 的一环时只写阶段字段，不能覆盖外层正在跑的状态。
 */
async function beginStage(
  spec: StageSpec,
  standalone: boolean,
  total: number,
): Promise<void> {
  await KungalSync.updateProgress({
    ...(standalone
      ? {
          status: 'running' as const,
          type: spec.type,
          startedAt: new Date().toISOString(),
          completedAt: null,
          errors: 0,
        }
      : {}),
    stage: spec.stage,
    ...spec.reset(total),
  })
  await KungalSync.addLog('info', `${spec.label}阶段开始: ${total} 个作品`)
}

/**
 * 没有待同步作品时的收尾。
 *
 * standalone 必须显式写 completed：锁已经释放，不会再有别的代码改这份进度，
 * 不写就会让管理页永远停在「运行中」。
 */
async function finishStageWithoutTargets(
  spec: StageSpec,
  standalone: boolean,
): Promise<void> {
  if (standalone) {
    await KungalSync.updateProgress({
      status: 'completed',
      type: spec.type,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      stage: null,
    })
  }
  await KungalSync.addLog('info', `${spec.label}同步: 没有待同步的作品`)
}

/**
 * 阶段收尾：累计失败数、落最终计数、standalone 时收尾成 completed、打两条
 * 完成日志（addLog 进进度面板，console 进容器日志）。
 *
 * summary 由调用方拼（各阶段的计数项不同），但前缀固定是「X阶段完成: 」，
 * console 那行统一加 ✅ Kungal 前缀，保持运维 grep 的字符串不变。
 */
async function finishStage(
  standalone: boolean,
  stageErrors: number,
  counts: Partial<KungalSyncProgress>,
  summary: string,
): Promise<void> {
  // 失败数并入整轮 errors（standalone 时开头已重置为 0）
  const current = await KungalSync.getProgress()
  await KungalSync.updateProgress({
    errors: (current.errors ?? 0) + stageErrors,
    ...counts,
    ...(standalone
      ? {
          status: 'completed' as const,
          completedAt: new Date().toISOString(),
          stage: null,
        }
      : {}),
  })
  await KungalSync.addLog(stageErrors > 0 ? 'error' : 'success', summary)
  console.log(`✅ Kungal ${summary}`)
}

/**
 * 一批作品并发拉子资源（名册 / 攻略列表）。
 *
 * 用 allSettled 而不是 all：一个作品 404 或超时就该只丢它自己，不能把同批另外
 * 九个作品一起丢掉。失败作品整条不出现在返回值里，由下一轮同步补。
 */
async function fetchWorkRowsInBatch<T>(
  batch: Array<{ id: string }>,
  fetchRows: (workId: string) => Promise<T[]>,
  onFailure: () => void,
  failureLabel: string,
): Promise<Array<{ workId: string; rows: T[] }>> {
  const settled = await Promise.allSettled(
    batch.map(async (work) => ({
      workId: work.id,
      rows: await fetchRows(work.id),
    })),
  )
  const out: Array<{ workId: string; rows: T[] }> = []
  for (const item of settled) {
    if (item.status === 'fulfilled') {
      out.push(item.value)
    } else {
      onFailure()
      console.error(`❌ Kungal ${failureLabel}拉取失败:`, item.reason)
    }
  }
  return out
}

let _progressCache: KungalSyncProgress | null = null

export interface KungalSyncProgress {
  status: 'idle' | 'running' | 'completed' | 'failed'
  /**
   * 'characters' = 只跑角色阶段（POST /kungal-sync/characters）；
   * 'walkthroughs' = 只跑攻略阶段（POST /kungal-sync/walkthroughs）。
   */
  type: 'full' | 'delta' | 'characters' | 'walkthroughs' | null
  startedAt: string | null
  completedAt: string | null
  stage: 'resolve' | 'works' | 'characters' | 'walkthroughs' | 'cache' | null
  totalItems: number
  processedItems: number
  errors: number
  resolvedCount: number
  /** 角色阶段：本次要处理的作品数。 */
  characterTotal: number
  /** 角色阶段：已 upsert 的角色行数。 */
  charactersUpserted: number
  /** 角色阶段：已 upsert 的名册（出场）行数。 */
  appearancesUpserted: number
  /** 攻略阶段：本次要处理的作品数。 */
  walkthroughTotal: number
  /** 攻略阶段：已 upsert 的攻略行数。 */
  walkthroughsUpserted: number
  /** 攻略阶段：实际拉过的详情请求数（= 新出现或 updated_at 变了的攻略数）。 */
  walkthroughDetails: number
  /** 攻略阶段：因上游已下线而删掉的本地行数。 */
  walkthroughsRemoved: number
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
  characterTotal: 0,
  charactersUpserted: 0,
  appearancesUpserted: 0,
  walkthroughTotal: 0,
  walkthroughsUpserted: 0,
  walkthroughDetails: 0,
  walkthroughsRemoved: 0,
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
    // 失败收尾由 runSync 自己在进度里写（它能区分「解析失败」与「落库失败」），
    // 这里只负责锁：不要给 withSyncLock 传 failureLog，否则会覆盖更细的进度。
    await withSyncLock('kungal-sync-full', LOCK_TTL_LONG_MS, async () => {
      await this.runSync('full', onProgress)
    })
  },

  async syncDelta(onProgress?: (processed: number, total: number) => void) {
    await withSyncLock('kungal-sync-delta', LOCK_TTL_DELTA_MS, async () => {
      await this.runSync('delta', onProgress)
    })
  },

  /**
   * 只同步角色（管理端手动触发 / 队列 type='kungal-characters'）。
   * 与作品同步共用 runCharacterStage，但锁独立：作品同步与角色同步可以同时跑，
   * 两次角色同步不会重叠。
   */
  async syncCharacters(
    onProgress?: (processed: number, total: number) => void,
  ) {
    await withSyncLock(
      'kungal-sync-characters',
      LOCK_TTL_LONG_MS,
      async () => {
        await this.runCharacterStage({ standalone: true }, onProgress)
      },
      // 整体失败（kungal 不可达 / DB 连不上 / 写库失败）必须把进度收尾成
      // failed，否则管理页永远停在「运行中」。
      { failureLog: '角色同步失败' },
    )
  },

  /**
   * 只同步攻略（管理端手动触发 / 队列 type='kungal-walkthroughs'）。
   *
   * 锁独立于作品/角色同步：攻略阶段与作品同步可以并行（两者都只写自己的表），
   * 但两次攻略同步不会重叠 —— 否则同一 work 的「拉列表 → 删本地多余行」
   * 会互相踩，把对方刚写进来的行删掉。
   */
  async syncWalkthroughs(
    onProgress?: (processed: number, total: number) => void,
  ) {
    await withSyncLock(
      'kungal-sync-walkthroughs',
      LOCK_TTL_LONG_MS,
      async () => {
        await this.runWalkthroughStage({ standalone: true }, onProgress)
      },
      { failureLog: '攻略同步失败' },
    )
  },

  /**
   * 角色阶段：名册（works/{id}/characters）→ ids= 批量水合 → upsert characters + appearances。
   *
   * 为什么要两步：作品行的 include=characters 名册只有名字/图片/roster_role/
   * spoiler，没有 gender/birthday/三围/简介/traits；这些资料只在
   * /catalog/characters?ids=…&view=full 上发布，且 ids= 批量通道 ≤100/次。
   *
   * 失败口径：单批（10 个作品）失败只计数不抛出 —— 角色是附加数据，
   * 不应该让整轮作品同步失败；外层的 syncCharacters 才把整体异常收尾成 failed。
   */
  async runCharacterStage(
    options?: { workIds?: string[]; standalone?: boolean },
    onProgress?: (processed: number, total: number) => void,
  ) {
    // 缺钥/废钥在动数据库之前就炸。角色阶段是「逐批 catch、只计数不抛」的
    // 形态，不做这个断言会安静地跑完整轮、把每部作品都记成失败。
    assertKungalKey()
    const targets = await this.getCharacterTargets(options?.workIds)
    const standalone = options?.standalone === true
    if (targets.length === 0) {
      await finishStageWithoutTargets(CHARACTER_STAGE, standalone)
      return
    }
    await beginStage(CHARACTER_STAGE, standalone, targets.length)

    let charactersUpserted = 0
    let appearancesUpserted = 0
    let characterErrors = 0
    let processed = 0

    for (let i = 0; i < targets.length; i += CHARACTER_WORK_BATCH) {
      const batch = targets.slice(i, i + CHARACTER_WORK_BATCH)
      try {
        // 1) 名册：每作品游标翻页（单作品失败只丢它自己，见 fetchWorkRowsInBatch）
        const rosters = await fetchWorkRowsInBatch<KungalWorkCharacter>(
          batch,
          (workId) => KungalClient.fetchWorkCharacters(workId),
          () => characterErrors++,
          '角色名册',
        )
        if (rosters.length === 0) continue

        // 2) 名册里的 character id 去重后走 ids= 水合（≤100/次）
        const ids = [
          ...new Set(
            rosters.flatMap((r) => r.rows.map((row) => String(row.id))),
          ),
        ]
        const hydrated = new Map<string, KungalCharacterItem>()
        for (let h = 0; h < ids.length; h += RESOLVE_BATCH) {
          const chunk = ids.slice(h, h + RESOLVE_BATCH)
          try {
            for (const item of await KungalClient.hydrateCharactersByIds(
              chunk,
            )) {
              hydrated.set(String(item.id), item)
            }
          } catch (err) {
            // 单批水合失败只丢资料字段：下面用名册兜底行继续落库名册行
            characterErrors++
            console.error('❌ Kungal 角色水合失败:', err)
          }
        }

        // 3) 组装行：水合命中 → full；未命中 → 名册兜底（保证 appearances 外键成立）
        const characterRows = new Map<string, KungalCharacterRow>()
        for (const { rows } of rosters) {
          for (const row of rows) {
            const id = String(row.id)
            if (characterRows.has(id)) continue
            const full = hydrated.get(id)
            characterRows.set(
              id,
              full
                ? normalizeCharacter(full)
                : normalizeCharacterFromRoster(row),
            )
          }
        }
        // 水合多回来的（极少数：NSFW 门差异导致名册里没有）也一并落库，
        // 但不为它们建本作品的名册行。
        for (const [id, item] of hydrated) {
          if (!characterRows.has(id))
            characterRows.set(id, normalizeCharacter(item))
        }

        // 4) 名册行：同一 (work, character) 只留第一条 —— 复合主键冲突会在
        //    ON CONFLICT 里二次命中同一行，Postgres 报 21000 让整批失败。
        const seen = new Set<string>()
        const appearanceRows: KungalAppearanceRow[] = []
        for (const { workId, rows } of rosters) {
          rows.forEach((row, idx) => {
            const key = `${workId}:${row.id}`
            if (seen.has(key)) return
            seen.add(key)
            appearanceRows.push(normalizeAppearance(workId, row, idx))
          })
        }

        const syncedAt = new Date()
        const characterValues = [...characterRows.values()].map((row) => ({
          ...row,
          // 全部 jsonb 列统一走 ::text::jsonb，绕开驱动二次编码（与 works 同因）
          localized: jsonbTextOrNull(row.localized),
          measurements: jsonbTextOrNull(row.measurements),
          image: jsonbTextOrNull(row.image),
          figure: jsonbTextOrNull(row.figure),
          intros: jsonbTextOrNull(row.intros),
          traits: jsonbTextOrNull(row.traits),
          refs: jsonbTextOrNull(row.refs),
          syncedAt,
        }))
        const appearanceValues = appearanceRows.map((row) => ({
          ...row,
          syncedAt,
        }))

        // 5) 一个事务写 characters + appearances + 清理上游已删的名册行
        await db.transaction(async (tx) => {
          if (characterValues.length > 0) {
            await tx
              .insert(kungalCharacters)
              .values(characterValues)
              .onConflictDoUpdate({
                target: kungalCharacters.id,
                set: {
                  displayName: sql`excluded.display_name`,
                  latin: sql`excluded.latin`,
                  lang: sql`excluded.lang`,
                  localized: sql`excluded.localized`,
                  gender: sql`excluded.gender`,
                  birthday: sql`excluded.birthday`,
                  bloodType: sql`excluded.blood_type`,
                  heightCm: sql`excluded.height_cm`,
                  weightKg: sql`excluded.weight_kg`,
                  measurements: sql`excluded.measurements`,
                  imageUrl: sql`excluded.image_url`,
                  imageWidth: sql`excluded.image_width`,
                  imageHeight: sql`excluded.image_height`,
                  imageThumbhash: sql`excluded.image_thumbhash`,
                  image: sql`excluded.image`,
                  figure: sql`excluded.figure`,
                  intro: sql`excluded.intro`,
                  intros: sql`excluded.intros`,
                  instanceOfId: sql`excluded.instance_of_id`,
                  traits: sql`excluded.traits`,
                  refs: sql`excluded.refs`,
                  syncedAt: sql`excluded.synced_at`,
                },
              })
          }
          if (appearanceValues.length > 0) {
            await tx
              .insert(kungalCharacterAppearances)
              .values(appearanceValues)
              .onConflictDoUpdate({
                target: [
                  kungalCharacterAppearances.characterId,
                  kungalCharacterAppearances.workId,
                ],
                set: {
                  rosterRole: sql`excluded.roster_role`,
                  spoiler: sql`excluded.spoiler`,
                  sortOrder: sql`excluded.sort_order`,
                  syncedAt: sql`excluded.synced_at`,
                },
              })
          }
          // 名册以本次上游结果为准：清掉本作品已不存在的角色行（角色被删/合并），
          // 否则作品页会一直显示幽灵角色。名册为空 = 上游确实没有角色，同样清空。
          for (const { workId, rows } of rosters) {
            const keep = [...new Set(rows.map((row) => String(row.id)))]
            await tx
              .delete(kungalCharacterAppearances)
              .where(
                keep.length > 0
                  ? and(
                      eq(kungalCharacterAppearances.workId, workId),
                      notInArray(kungalCharacterAppearances.characterId, keep),
                    )
                  : eq(kungalCharacterAppearances.workId, workId),
              )
          }
        })

        charactersUpserted += characterValues.length
        appearancesUpserted += appearanceValues.length
      } catch (err) {
        // 单批失败（DB 抖动/上游形状异常）吞掉并计数，继续下一批：
        // 角色是附加数据，不该让整轮作品同步失败。
        characterErrors += batch.length
        console.error(
          `❌ Kungal 角色批 ${i / CHARACTER_WORK_BATCH + 1} 失败:`,
          err,
        )
      }

      processed += batch.length
      await this.updateProgress({
        stage: 'characters',
        characterTotal: targets.length,
        charactersUpserted,
        appearancesUpserted,
      })
      onProgress?.(processed, targets.length)
      await this.addLog(
        'info',
        `characters batch ${Math.min(i + CHARACTER_WORK_BATCH, targets.length)}/${targets.length} done`,
      )
    }

    await finishStage(
      standalone,
      characterErrors,
      { charactersUpserted, appearancesUpserted },
      `角色阶段完成: 作品 ${targets.length}, 角色 ${charactersUpserted}, 名册 ${appearancesUpserted}, 失败 ${characterErrors}`,
    )
  },

  /**
   * 按阶段遍历的作品集合（角色 / 攻略阶段共用）。
   * - 指定 workIds：只同步这些作品（增量补 / 手动补）
   * - 未指定：galrc_kungal_works 全表，先有 vndb 锚点的、再 kungal-only 的
   *
   * 顺序有意义：vndb 锚点作品是用户在站内能点到的条目，kungal-only 作品只在
   * 网盘目录里出现，排后面可以保证可访问条目的附加数据先齐。
   */
  async getSyncTargets(
    workIds?: string[],
  ): Promise<Array<{ id: string; vndbId: string | null }>> {
    const columns = { id: kungalWorks.id, vndbId: kungalWorks.vndbId }
    if (workIds) {
      const unique = [...new Set(workIds)]
      if (unique.length === 0) return []
      return await db
        .select(columns)
        .from(kungalWorks)
        .where(inArray(kungalWorks.id, unique))
        .orderBy(sql`${kungalWorks.vndbId} IS NULL`, kungalWorks.id)
    }
    return await db
      .select(columns)
      .from(kungalWorks)
      .orderBy(sql`${kungalWorks.vndbId} IS NULL`, kungalWorks.id)
  },

  /** 角色阶段的作品集合（语义等同 getSyncTargets，保留命名便于调用处读起来清楚）。 */
  async getCharacterTargets(
    workIds?: string[],
  ): Promise<Array<{ id: string; vndbId: string | null }>> {
    return await this.getSyncTargets(workIds)
  },

  /**
   * 增量同步的角色目标：本次同步到的作品 + 还没有任何名册行的存量作品。
   *
   * 后者是角色功能上线前的历史缺口。每轮最多补 DELTA_CHARACTER_BACKFILL 个：
   * 一次 delta 把全表名册请求打出去会占满 kungal 限流，也会让增量任务变慢。
   */
  async getDeltaCharacterWorkIds(syncedWorkIds: string[]): Promise<string[]> {
    const missing = await db
      .select({ id: kungalWorks.id })
      .from(kungalWorks)
      .where(
        sql`NOT EXISTS (SELECT 1 FROM ${kungalCharacterAppearances} ca WHERE ca.work_id = ${kungalWorks.id})`,
      )
      .limit(DELTA_CHARACTER_BACKFILL)
    return [...new Set([...syncedWorkIds, ...missing.map((r) => r.id)])]
  },

  /**
   * 攻略阶段：全局目录翻页发现 → ids= 批量刷新变更行 → 只为变更行拉 chart。
   *
   * 为什么不逐作品拉列表：/catalog/walkthroughs **不带 work_id 时就是全站攻略
   * 集合**（id 键集分页，100 条/页）。全站约 4.2k 条攻略只要 ~43 个请求，而
   * 1991 部作品逐个拉列表要 1991 个请求 —— 这是本阶段此前最大的一笔开销，也是
   * 把限流额度打爆、进而被上游 403 的元凶之一。
   *
   * 三步走：
   * 1) 目录页用 fields= 裁到 id/work_id/updated_at，只做「发现 + 变更比对」；
   * 2) 真正要落库的行走 ids= 批量车道（≤100/次）水合完整列表行；
   * 3) chart 仍然只能逐条拉详情 —— 集合面的 include 词表是空的
   *    （/catalog/schemas/walkthrough 返回 "include": []），chart 只在
   *    GET /catalog/walkthroughs/{id} 上。
   *
   * 下线判定换成目录全局口径：范围内的本地行 id 不在目录里 = 上游下线/合并。
   * 因此**读取阶段失败时绝不删行** —— 半截目录会被当成「全都下线」，误删一大片。
   *
   * 失败口径与角色阶段一致：异常只计数不抛出（攻略是附加数据，不该让整轮作品
   * 同步失败）；但读取阶段（目录 / 本地行）失败直接收尾，不在不知道全量的情况
   * 下写库或删行。
   */
  async runWalkthroughStage(
    options?: { workIds?: string[]; standalone?: boolean },
    onProgress?: (processed: number, total: number) => void,
  ) {
    assertKungalKey()
    const targets = await this.getSyncTargets(options?.workIds)
    const standalone = options?.standalone === true
    if (targets.length === 0) {
      await finishStageWithoutTargets(WALKTHROUGH_STAGE, standalone)
      return
    }
    await beginStage(WALKTHROUGH_STAGE, standalone, targets.length)

    const scope = new Set(targets.map((t) => t.id))
    // 本次范围内真正被写过/删过的作品（进度用，不去猜批次数）
    const touched = new Set<string>()
    let upserted = 0
    let details = 0
    let removed = 0
    let walkthroughErrors = 0

    // ── 读取阶段 ────────────────────────────────────────────────────────
    // 1) 全局目录：id → 上游 work_id / updated_at。只收范围内的作品 —— 上游有
    //    而本地没有的作品直接跳过（攻略行有 works 外键，补作品是 works 阶段的
    //    职责，这里不越权建行）。
    // 2) 本地范围内已有行：用来判断「有没有 chart / updated_at 变没变」。
    const index = new Map<
      string,
      { workId: string; updatedAt: number | null }
    >()
    const local = new Map<
      string,
      { updatedAt: number | null; hasChart: boolean }
    >()
    try {
      const rows = await KungalClient.fetchWalkthroughIndex()
      for (const row of rows) {
        const workId = String(row.work_id)
        if (!scope.has(workId)) continue
        const ts = row.updated_at
          ? new Date(row.updated_at).getTime()
          : Number.NaN
        index.set(String(row.id), {
          workId,
          // 解不出上游时间按「变了」处理（与原来单作品口径一致，宁可多拉一次）
          updatedAt: Number.isNaN(ts) ? null : ts,
        })
      }

      const scopeIds = [...scope]
      for (let i = 0; i < scopeIds.length; i += WALKTHROUGH_LOCAL_BATCH) {
        const chunk = scopeIds.slice(i, i + WALKTHROUGH_LOCAL_BATCH)
        const localRows = await db
          .select({
            id: kungalWalkthroughs.id,
            upstreamUpdatedAt: kungalWalkthroughs.upstreamUpdatedAt,
            hasChart: sql<boolean>`${kungalWalkthroughs.chart} IS NOT NULL`.as(
              'has_chart',
            ),
          })
          .from(kungalWalkthroughs)
          .where(inArray(kungalWalkthroughs.workId, chunk))
        for (const row of localRows) {
          local.set(row.id, {
            updatedAt: row.upstreamUpdatedAt?.getTime() ?? null,
            hasChart: row.hasChart === true,
          })
        }
      }
    } catch (err) {
      walkthroughErrors += targets.length
      const message = err instanceof Error ? err.message : String(err)
      console.error(
        '❌ Kungal 攻略目录/本地行读取失败（本轮不写库、不删行）:',
        err,
      )
      await this.addLog('error', `攻略目录读取失败: ${message}`)
      await finishStage(
        standalone,
        walkthroughErrors,
        {
          walkthroughsUpserted: 0,
          walkthroughDetails: 0,
          walkthroughsRemoved: 0,
        },
        `攻略阶段完成: 作品 ${targets.length}, 攻略 0, 详情 0, 下线 0, 失败 ${walkthroughErrors}`,
      )
      return
    }

    // ── 变更集合 ────────────────────────────────────────────────────────
    // ① 本地没有的行（新攻略）；② updated_at 变了（上游改过）；③ 本地 chart
    // 为 NULL（上次详情请求失败留下的半截行，让失败可以自愈）。
    const refresh = new Set<string>()
    for (const [id, up] of index) {
      const prev = local.get(id)
      if (
        !prev ||
        up.updatedAt === null ||
        prev.updatedAt !== up.updatedAt ||
        !prev.hasChart
      ) {
        refresh.add(id)
      }
    }
    await this.addLog(
      'info',
      `攻略目录: 范围内 ${index.size} 条, 本地 ${local.size} 条, 待刷新 ${refresh.size} 条`,
    )
    await this.updateProgress({
      stage: 'walkthroughs',
      walkthroughTotal: targets.length,
      walkthroughsUpserted: 0,
      walkthroughDetails: 0,
      walkthroughsRemoved: 0,
    })

    // ── 刷新阶段 ────────────────────────────────────────────────────────
    // 3) ids= 批量水合完整列表行（≤100/次，不含 chart）。
    const rowsById = new Map<string, KungalWalkthrough>()
    const refreshIds = [...refresh]
    for (let i = 0; i < refreshIds.length; i += WALKTHROUGH_ID_BATCH) {
      const chunk = refreshIds.slice(i, i + WALKTHROUGH_ID_BATCH)
      try {
        for (const item of await KungalClient.fetchWalkthroughsByIds(chunk)) {
          rowsById.set(String(item.id), item)
        }
      } catch (err) {
        walkthroughErrors += chunk.length
        console.error(
          `❌ Kungal 攻略批量刷新失败（${chunk[0]}…，${chunk.length} 条）:`,
          err,
        )
      }
    }

    // 4) chart：只有详情面带图，逐条拉。单条失败只丢 chart，列表字段照常落库。
    //    并发按 WALKTHROUGH_DETAIL_BATCH 分批，避免一次性打出几千个请求。
    const charts = new Map<string, KungalWalkthroughChart>()
    const detailIds = [...rowsById.keys()]
    for (let i = 0; i < detailIds.length; i += WALKTHROUGH_DETAIL_BATCH) {
      const chunk = detailIds.slice(i, i + WALKTHROUGH_DETAIL_BATCH)
      const settled = await Promise.allSettled(
        chunk.map(async (id) => ({
          id,
          row: await KungalClient.fetchWalkthrough(id),
        })),
      )
      for (const item of settled) {
        if (item.status === 'rejected') {
          walkthroughErrors++
          console.error('❌ Kungal 攻略详情拉取失败:', item.reason)
          continue
        }
        const { id, row } = item.value
        if (!row?.chart) {
          console.warn(`⚠️ Kungal 攻略 ${id} 详情无 chart（可能刚下线）`)
          continue
        }
        charts.set(id, row.chart)
        details++
      }
      await this.updateProgress({
        stage: 'walkthroughs',
        walkthroughDetails: details,
      })
    }

    // ── 落库 ────────────────────────────────────────────────────────────
    // 5) 有 chart 的一批、只有列表行的一批。三块 jsonb 统一走 ::text::jsonb，
    //    绕开驱动二次编码（与 works 同因）；characters 恒为数组。
    const syncedAt = new Date()
    const toValues = (row: KungalWalkthroughRow) => ({
      ...row,
      release: jsonbTextOrNull(row.release),
      characters: jsonbTextOrNull(row.characters),
      chart: jsonbTextOrNull(row.chart),
      syncedAt,
    })
    const withChart: KungalWalkthroughRow[] = []
    const keepChart: KungalWalkthroughRow[] = []
    for (const [id, item] of rowsById) {
      const row = normalizeWalkthrough(item)
      const chart = charts.get(id)
      if (chart) withChart.push({ ...row, chart })
      else keepChart.push(row)
    }

    const upsertRows = async (
      rows: KungalWalkthroughRow[],
      writeChartColumn: boolean,
    ) => {
      for (let i = 0; i < rows.length; i += WALKTHROUGH_UPSERT_BATCH) {
        const chunk = rows.slice(i, i + WALKTHROUGH_UPSERT_BATCH)
        try {
          await db
            .insert(kungalWalkthroughs)
            .values(chunk.map(toValues))
            .onConflictDoUpdate({
              target: kungalWalkthroughs.id,
              set: writeChartColumn
                ? WALKTHROUGH_UPSERT_SET_WITH_CHART
                : WALKTHROUGH_UPSERT_SET,
            })
          upserted += chunk.length
          for (const row of chunk) touched.add(row.workId)
        } catch (err) {
          walkthroughErrors += chunk.length
          console.error(
            `❌ Kungal 攻略批 ${i / WALKTHROUGH_UPSERT_BATCH + 1} 落库失败:`,
            err,
          )
        }
        await this.updateProgress({
          stage: 'walkthroughs',
          walkthroughsUpserted: upserted,
          walkthroughDetails: details,
          walkthroughsRemoved: removed,
        })
        onProgress?.(Math.min(touched.size, targets.length), targets.length)
      }
    }
    await upsertRows(withChart, true)
    await upsertRows(keepChart, false)

    // 6) 下线：目录就是权威人口 —— 范围内本地行 id 不在目录里 = 上游下线/合并。
    //    只会在目录完整翻完之后走到这里（读取阶段抛错时已提前 return）。
    const stale = [...local.keys()].filter((id) => !index.has(id))
    for (let i = 0; i < stale.length; i += WALKTHROUGH_DELETE_BATCH) {
      const chunk = stale.slice(i, i + WALKTHROUGH_DELETE_BATCH)
      try {
        const deleted = await db
          .delete(kungalWalkthroughs)
          .where(inArray(kungalWalkthroughs.id, chunk))
          .returning({ id: kungalWalkthroughs.id })
        removed += deleted.length
      } catch (err) {
        walkthroughErrors += chunk.length
        console.error(
          `❌ Kungal 攻略下线清理失败（${chunk[0]}…，${chunk.length} 条）:`,
          err,
        )
      }
    }
    if (removed > 0) {
      await this.updateProgress({
        stage: 'walkthroughs',
        walkthroughsRemoved: removed,
      })
    }
    onProgress?.(targets.length, targets.length)

    await finishStage(
      standalone,
      walkthroughErrors,
      {
        walkthroughsUpserted: upserted,
        walkthroughDetails: details,
        walkthroughsRemoved: removed,
      },
      `攻略阶段完成: 作品 ${targets.length}, 攻略 ${upserted}, 详情 ${details}, 下线 ${removed}, 失败 ${walkthroughErrors}`,
    )
  },

  /**
   * 增量同步的攻略目标：本次同步到的作品 + 还没有任何攻略行的存量作品。
   *
   * 后者是攻略功能上线前的历史缺口。每轮最多补 DELTA_WALKTHROUGH_BACKFILL 个：
   * 「没有攻略」的作品本来就永远补不齐（多数作品真的没有攻略），用上限把每轮
   * 的额外请求量钉死，避免 delta 变成隐形全量。
   */
  async getDeltaWalkthroughWorkIds(syncedWorkIds: string[]): Promise<string[]> {
    const missing = await db
      .select({ id: kungalWorks.id })
      .from(kungalWorks)
      .where(
        sql`NOT EXISTS (SELECT 1 FROM ${kungalWalkthroughs} wt WHERE wt.work_id = ${kungalWorks.id})`,
      )
      .limit(DELTA_WALKTHROUGH_BACKFILL)
    return [...new Set([...syncedWorkIds, ...missing.map((r) => r.id)])]
  },

  /** full = 全部 alistb 锚点；delta = 新作品及缺少封面尺寸的旧记录。 */
  async runSync(
    type: 'full' | 'delta',
    onProgress?: (processed: number, total: number) => void,
  ) {
    // 同步是长跑：缺钥/废钥必须在这里就失败，而不是每条请求 401、最后收下
    // 一堆 per-batch 错误。失败的进度收尾由 withSyncLock 负责。
    assertKungalKey()
    // 两路锚点：① vndb 锚点（走 refs= 批量通道）② 只有 kungal 锚点的条目
    // （走 ids= 批量通道）。后者此前完全没有同步入口 —— 网盘先出现
    // [kungal-X] 目录、目录里又没有 vndb 锚点时，galrc_alistb 有行而
    // galrc_kungal_works 永远缺行，详情页只能渲染空壳（标题 null / 无封面）。
    const vids = await this.getAlistbVids()
    const kungalOnlyIds = await this.getKungalOnlyWorkIds()
    if (vids.length === 0 && kungalOnlyIds.length === 0) {
      // delta 即使没有需要同步的条目，也要消费 redirects（合并事件与条目无关），
      // 并补一轮「还没有名册行 / 攻略行」的存量作品（角色与攻略功能上线前的缺口）。
      if (type === 'delta') {
        await this.consumeRedirects()
        await this.runCharacterStage({
          workIds: await this.getDeltaCharacterWorkIds([]),
        })
        // 攻略与角色同一口径：即使本轮没有作品要同步，也要补一轮存量缺口，
        // 否则攻略功能上线后的第一次 delta 什么都不会做。
        await this.runWalkthroughStage({
          workIds: await this.getDeltaWalkthroughWorkIds([]),
        })
      }
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
      if (type === 'delta') {
        await this.consumeRedirects()
        await this.runCharacterStage({
          workIds: await this.getDeltaCharacterWorkIds([]),
        })
        // 攻略与角色同一口径：即使本轮没有作品要同步，也要补一轮存量缺口，
        // 否则攻略功能上线后的第一次 delta 什么都不会做。
        await this.runWalkthroughStage({
          workIds: await this.getDeltaWalkthroughWorkIds([]),
        })
      }
      return
    }

    console.log(
      `🔄 Kungal ${type} 同步开始（限速 ${kungalRatePerMin()} 次/分）: ${target.length} 个 VN + ${kungalTarget.length} 个 kungal-only 条目`,
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
    // 本次真正落库的 work id：增量同步的角色阶段只补这些作品（外加无名册的存量）
    const syncedWorkIds: string[] = []
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
        syncedWorkIds.push(...kept.map(({ work }) => work.id))

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

    // 阶段 2.6：角色名册与资料。必须排在作品落库之后（appearances 外键指向
    // galrc_kungal_works）；全量跑全表，增量只跑本次作品 + 尚无角色名册的存量，
    // 避免每轮 delta 都把全目录角色请求重打一遍。
    await this.runCharacterStage({
      workIds:
        type === 'delta'
          ? await this.getDeltaCharacterWorkIds(syncedWorkIds)
          : undefined,
    })

    // 阶段 2.7：攻略。同样必须排在作品落库之后（walkthroughs.work_id 外键指向
    // galrc_kungal_works）；全量跑全表，增量只跑本次作品 + 尚无攻略行的存量。
    // 攻略阶段自己会按 updated_at 决定要不要拉详情，所以这里的"全表"并不等于
    // 全量重拉 chart。
    await this.runWalkthroughStage({
      workIds:
        type === 'delta'
          ? await this.getDeltaWalkthroughWorkIds(syncedWorkIds)
          : undefined,
    })

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
    await purgeAfterSync()
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
    assertKungalKey()
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
    // 同 VndbSync：把本轮新增的进度日志桥接到当前队列任务（/admin/tasks 日志 tab）。
    forwardTaskLogs(partial.logs)
  },

  /**
   * 收尾「假运行中」的进度记录：进程被 kill 后 status 会永远停在 running，
   * 管理页就变成一个永远不会停的转圈。
   *
   * 判定要有两层，缺一不可：
   * 1) lastUpdated 超过 STALE_PROGRESS_MS —— 一批 10 个作品要跑 30s–8min，
   *    刚启动的进程还没写进度是正常的，用时间兜住这段静默期；
   * 2) 四个同步锁一个都不存在 —— 只要有锁，就说明有进程正握着锁在跑，
   *    哪怕它很久没写进度也不能判死（否则会把正在跑的长任务标成失败）。
   * 顺序不能反：先看时间，再看锁，能省掉三次 Redis 往返。
   *
   * 只在「读进度」的 UI 路径上调用，不要放进 getProgress —— addLog/updateProgress
   * 都会回调 getProgress，那会变成每次写进度都做一次对账（递归 + 写放大）。
   *
   * @returns 1 = 本次修好了一条；0 = 无需处理
   */
  async reconcileStaleProgress(): Promise<number> {
    // dev 下 REDIS_ENABLED=false 时 acquireLockKv 是直接放行、根本没有锁键，
    // 「锁不存在」不代表进程死了 —— 这种情况下无从判断，直接跳过。
    if (!isRedisEnabled) return 0
    const progress = await this.getProgress()
    if (progress.status !== 'running') return 0
    const lastUpdated = Date.parse(progress.lastUpdated)
    const idleMs = Number.isNaN(lastUpdated)
      ? Number.POSITIVE_INFINITY
      : Date.now() - lastUpdated
    if (idleMs < STALE_PROGRESS_MS) return 0
    // 串行查四个锁：任何一个还在持有就说明真有进程在跑。
    // 查询失败（null）同样返回 0：Redis 不可达时无法判断，宁可漏收尾一次，
    // 也不能把仍在跑的同步误标成失败。
    for (const lockKey of SYNC_LOCK_KEYS) {
      const held = await isLockHeldKv(lockKey)
      if (held === null || held) return 0
    }
    const message = '检测到上次同步进程已中断（无锁持有），已标记为失败'
    await this.updateProgress({
      status: 'failed',
      stage: null,
      completedAt: new Date().toISOString(),
    })
    await this.addLog('error', message)
    console.log(`⚠️ Kungal ${message}`)
    return 1
  },

  /**
   * 管理端读进度专用：先对账再返回。
   *
   * 对账失败只 warn —— 收尾是锦上添花，不能因为它让管理页 500。
   */
  async getProgressForUi(): Promise<KungalSyncProgress> {
    try {
      await this.reconcileStaleProgress()
    } catch (err) {
      console.warn('⚠️ Kungal 进度对账失败（忽略，继续返回当前进度）:', err)
    }
    return await this.getProgress()
  },

  async getProgress(): Promise<KungalSyncProgress> {
    const row = await db
      .select({ config: siteConfig.config })
      .from(siteConfig)
      .where(eq(siteConfig.key, 'kungalSyncProgress'))
      .limit(1)
    const stored = row[0]?.config as Partial<KungalSyncProgress> | undefined
    // 老进度 JSON 里没有角色阶段的新计数（角色功能上线前写入的），按默认值补齐，
    // 否则管理页读到 undefined 会把计数渲染成 NaN。
    return stored ? { ...IDLE_PROGRESS, ...stored } : IDLE_PROGRESS
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
}
