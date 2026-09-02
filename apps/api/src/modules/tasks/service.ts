import { db, queueJob, queueJobLog } from '@api/libs'
import type { TaskPayload } from '@api/libs/queue'
import {
  defaultJobOptions,
  isQueueEnabled,
  isValidTask,
  QUEUE,
  QUEUE_PREFIX,
  queueOf,
} from '@api/libs/queue'
import {
  QUEUE_JOB_RETENTION_DAYS,
  QUEUE_LOG_TTL_DAYS,
} from '@api/libs/queue/config'
import { delKvPattern, getRedisClient } from '@api/libs/redis'
import { CronService } from '@api/modules/cron/service'
import { KungalSync } from '@api/modules/kungal-sync/service'
import { VndbSync } from '@api/modules/vndb-sync/service'
import { type Job, type Queue, Worker } from '@stacksjs/bun-queue'
import { and, count, desc, eq, inArray, lt } from 'drizzle-orm'
import { status } from 'elysia'

/** 百分数取整（total<=0 返回 0，避免除零）。 */
function percentOf(processed: number, total: number): number {
  if (total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((processed / total) * 100)))
}

/**
 * 任务日志器：把执行日志写入 galrc_queue_job_log，进度同步双写
 * galrc_queue_job.progress 与 bun-queue 的 job.progress（Redis，供 stalled/DLQ 语义）。
 */
export class JobLogger {
  private readonly job: Job<TaskPayload>

  constructor(job: Job<TaskPayload>) {
    this.job = job
  }

  private async write(
    level: 'info' | 'warn' | 'error' | 'success',
    message: string,
  ) {
    await db.insert(queueJobLog).values({
      jobId: this.job.id,
      level,
      message,
    })
  }

  info(message: string) {
    return this.write('info', message)
  }
  warn(message: string) {
    return this.write('warn', message)
  }
  error(message: string) {
    return this.write('error', message)
  }
  success(message: string) {
    return this.write('success', message)
  }

  /** 更新进度（0-100）：同时落 galrc_queue_job.progress 与 Redis job.progress。 */
  async progress(percent: number) {
    const p = Math.max(0, Math.min(100, Math.round(percent)))
    await Promise.all([
      db
        .update(queueJob)
        .set({ progress: p })
        .where(eq(queueJob.id, this.job.id)),
      this.job.updateProgress(p),
    ])
  }
}

/** 生命周期钩子：任务入队 / 开始 / 完成 / 失败 / 死信时维护 galrc_queue_job 状态。 */
export const TaskLifecycle = {
  async markQueued(queue: string, payload: TaskPayload, jobId: string) {
    await db
      .insert(queueJob)
      .values({
        id: jobId,
        queue,
        type: payload.type,
        status: 'queued',
        payload: payload as unknown as Record<string, unknown>,
      })
      .onConflictDoNothing()
  },
  /**
   * 标记 running。行不存在则插入（覆盖 cron 触发的任务首次执行），已存在则更新——
   * 也覆盖「一次失败后自动重试」的再次进入。
   */
  async markRunning(jobId: string, queue: string, payload: TaskPayload) {
    await db
      .insert(queueJob)
      .values({
        id: jobId,
        queue,
        type: payload.type,
        status: 'running',
        payload: payload as unknown as Record<string, unknown>,
        startedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: queueJob.id,
        set: {
          queue,
          type: payload.type,
          status: 'running',
          error: null,
          finishedAt: null,
          startedAt: new Date(),
        },
      })
  },
  async markCompleted(jobId: string, result: unknown) {
    await db
      .update(queueJob)
      .set({
        status: 'completed',
        finishedAt: new Date(),
        progress: 100,
        result: (result ?? null) as unknown as Record<string, unknown>,
      })
      .where(eq(queueJob.id, jobId))
  },
  async markFailed(jobId: string, error: string) {
    await db
      .update(queueJob)
      .set({ status: 'failed', finishedAt: new Date(), error })
      .where(eq(queueJob.id, jobId))
  },
  /** 死信：重试耗尽后进入 DLQ（由 queue.events jobMovedToDeadLetter 驱动）。 */
  async markDeadLetter(jobId: string, reason: string) {
    await db
      .update(queueJob)
      .set({
        status: 'dead-letter',
        finishedAt: new Date(),
        error: reason,
      })
      .where(eq(queueJob.id, jobId))
  },
  /** 死信重放（republish）：回到 queued，等待重新消费。 */
  async markRequeued(jobId: string) {
    await db
      .update(queueJob)
      .set({
        status: 'queued',
        error: null,
        finishedAt: null,
        progress: 0,
      })
      .where(eq(queueJob.id, jobId))
  },
  /** 进程异常重启对账：把上次遗留的 running 标记为 interrupted。 */
  async reconcileInterrupted() {
    const rows = await db
      .select({ id: queueJob.id })
      .from(queueJob)
      .where(eq(queueJob.status, 'running'))
    if (rows.length === 0) return 0
    await db
      .update(queueJob)
      .set({
        status: 'interrupted',
        finishedAt: new Date(),
        error: '进程重启中断（Worker 启动对账）',
      })
      .where(eq(queueJob.status, 'running'))
    console.log(
      `[queue] 启动对账: ${rows.length} 个 running 任务标记为 interrupted`,
    )
    return rows.length
  },
}

/** 入队：校验白名单 + 写 galrc_queue_job 记录 + 放入 bun-queue，返回 job.id。 */
export async function enqueue(queueName: string, payload: TaskPayload) {
  if (!isValidTask(queueName, payload.type)) {
    throw status(400, `非法任务: queue=${queueName} type=${payload.type}`)
  }

  // dev 无 Redis（决策 1）：不启动队列，手动触发按类型同步执行，便于本地调试。
  if (!isQueueEnabled) {
    if (payload.type.startsWith('meili-')) {
      await runMeiliHandler(payload, null)
      return `sync:${payload.type}:${Date.now()}`
    }
    throw new Error(`队列不可用（Redis 未启用），无法入队: ${queueName}`)
  }

  const queue = queueOf(queueName as (typeof QUEUE)[keyof typeof QUEUE])
  const job = await queue.add(payload, { ...defaultJobOptions })
  await TaskLifecycle.markQueued(queueName, payload, job.id)
  return job.id
}

// ── 查询（供 /tasks 路由）────────────────────────────────────────

/** 死信列表：从 bun-queue Redis DLQ 读取（原队列名已存入 job.name）。 */
export async function listDeadLetterJobs(
  queueName: string,
  pageSize: number,
  pageIndex: number,
) {
  if (!isQueueEnabled) return []
  const queue = queueOf(queueName as (typeof QUEUE)[keyof typeof QUEUE])
  const start = pageIndex * pageSize
  const jobs = await queue.getDeadLetterJobs(start, start + pageSize - 1)
  return jobs.map((job) => ({
    id: job.id,
    type: (job.data as TaskPayload | undefined)?.type ?? job.name ?? 'unknown',
    failedReason: job.failedReason ?? null,
    attemptsMade: job.attemptsMade ?? 0,
    stacktrace: job.stacktrace ?? [],
    timestamp: job.timestamp ?? 0,
  }))
}

/** 死信重放：重新入队原队列并重置 PG 状态（返回新 job，或 null）。 */
export async function republishDeadLetterJob(queueName: string, jobId: string) {
  if (!isQueueEnabled) {
    throw status(503, '队列不可用（Redis 未启用）')
  }
  const queue = queueOf(queueName as (typeof QUEUE)[keyof typeof QUEUE])
  const job = await queue.republishDeadLetterJob(jobId, { resetRetries: true })
  if (!job) {
    throw status(404, `死信任务不存在: ${jobId}`)
  }
  // PG 状态由 wireLifecycleEvents 的 jobRepublishedFromDeadLetter 事件重置；
  // 此处兜底（事件为异步发射，稳妥起见同步落一次）。
  await TaskLifecycle.markRequeued(jobId)
  return { ok: true, jobId }
}

/** 丢弃死信：从 DLQ 移除并同步删除 PG 记录。 */
export async function removeDeadLetterJob(queueName: string, jobId: string) {
  if (!isQueueEnabled) {
    throw status(503, '队列不可用（Redis 未启用）')
  }
  const queue = queueOf(queueName as (typeof QUEUE)[keyof typeof QUEUE])
  const ok = await queue.removeDeadLetterJob(jobId)
  if (!ok) throw status(404, `死信任务不存在: ${jobId}`)
  await db.delete(queueJob).where(eq(queueJob.id, jobId))
  return { ok: true }
}

/** 删除任务记录（历史终态清理）。同时删除其日志；若在 Redis 中仍存在则一并移除。 */
export async function deleteJob(jobId: string) {
  const rows = await db
    .select()
    .from(queueJob)
    .where(eq(queueJob.id, jobId))
    .limit(1)
  const job = rows[0]
  if (!job) throw status(404, `任务不存在: ${jobId}`)

  // 若任务仍滞留在 Redis（waiting/active/delayed/failed），从队列移除。
  if (isQueueEnabled) {
    try {
      const queue = queueOf(job.queue as (typeof QUEUE)[keyof typeof QUEUE])
      await queue.removeJob(jobId)
    } catch {
      // 任务可能已被移除或队列不可用，忽略
    }
  }

  await db.delete(queueJobLog).where(eq(queueJobLog.jobId, jobId))
  await db.delete(queueJob).where(eq(queueJob.id, jobId))
  return { ok: true }
}

/** 批量删除任务记录（历史终态清理）。 */
export async function batchDeleteJobs(jobIds: string[]) {
  if (jobIds.length === 0) return { ok: true, deleted: 0 }

  // 逐条尝试从 Redis 移除（仅日志记录失败，不阻断）。
  if (isQueueEnabled) {
    const rows = await db
      .select({ id: queueJob.id, queue: queueJob.queue })
      .from(queueJob)
      .where(inArray(queueJob.id, jobIds))
    for (const row of rows) {
      try {
        const queue = queueOf(row.queue as (typeof QUEUE)[keyof typeof QUEUE])
        await queue.removeJob(row.id)
      } catch {
        // 忽略
      }
    }
  }

  await db.delete(queueJobLog).where(inArray(queueJobLog.jobId, jobIds))
  const deleted = await db
    .delete(queueJob)
    .where(inArray(queueJob.id, jobIds))
    .returning({ id: queueJob.id })
  return { ok: true, deleted: deleted.length }
}

/** 重试失败/中断/死信任务：重新入队（生成新 jobId），保留原记录为终态。 */
export async function retryJob(jobId: string) {
  const rows = await db
    .select()
    .from(queueJob)
    .where(eq(queueJob.id, jobId))
    .limit(1)
  const job = rows[0]
  if (!job) throw status(404, `任务不存在: ${jobId}`)

  const retryable = ['failed', 'dead-letter', 'interrupted'].includes(
    job.status,
  )
  if (!retryable) {
    throw status(400, `仅失败/死信/中断的任务可重试（当前: ${job.status}）`)
  }

  const payload = (job.payload ?? {}) as TaskPayload
  if (!payload.type)
    throw status(400, `任务缺少 payload 类型，无法重试: ${jobId}`)

  // 死信任务走 DLQ 重放（保留原 jobId，重置重试次数）；其余重新入队（新 jobId）。
  if (job.status === 'dead-letter') {
    return await republishDeadLetterJob(job.queue, jobId)
  }

  const newJobId = await enqueue(job.queue, payload)
  return { ok: true, jobId: newJobId }
}

export async function listJobs(input: {
  queue?: string
  type?: string
  status?: string
  pageSize: number
  pageIndex: number
}) {
  const conditions = [
    input.queue ? eq(queueJob.queue, input.queue) : undefined,
    input.type ? eq(queueJob.type, input.type) : undefined,
    input.status ? eq(queueJob.status, input.status) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined)

  const where = conditions.length ? and(...conditions) : undefined

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(queueJob)
      .where(where)
      .orderBy(desc(queueJob.createdAt))
      .limit(input.pageSize)
      .offset(input.pageIndex * input.pageSize),
    db.select({ count: count() }).from(queueJob).where(where),
  ])

  return { items: rows, total: totalRow[0]?.count ?? 0 }
}

/** 按状态聚合计数（供状态筛选 Tabs 与顶部统计卡）。 */
export async function getTaskStats() {
  const rows = await db
    .select({
      status: queueJob.status,
      count: count(),
    })
    .from(queueJob)
    .groupBy(queueJob.status)

  const counts: Record<string, number> = {
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    'dead-letter': 0,
    interrupted: 0,
  }
  let total = 0
  for (const r of rows) {
    counts[r.status] = (counts[r.status] ?? 0) + r.count
    total += r.count
  }
  return { counts, total }
}

/** 各队列实时状态（来自 bun-queue Redis 计数，供队列状态卡）。 */
export async function getQueueStats() {
  if (!isQueueEnabled) {
    return (Object.values(QUEUE) as string[]).map((name) => ({
      queue: name,
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
    }))
  }
  const queues = Object.values(QUEUE) as (typeof QUEUE)[keyof typeof QUEUE][]
  const result = []
  for (const name of queues) {
    const queue = queueOf(name)
    const counts = await queue.getJobCounts()
    result.push({
      queue: name,
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      paused: counts.paused ?? 0,
    })
  }
  return result
}

export async function getJobDetail(jobId: string) {
  const rows = await db
    .select()
    .from(queueJob)
    .where(eq(queueJob.id, jobId))
    .limit(1)
  return rows[0] ?? null
}

export async function getJobLogs(
  jobId: string,
  pageSize: number,
  pageIndex: number,
) {
  return db
    .select()
    .from(queueJobLog)
    .where(eq(queueJobLog.jobId, jobId))
    .orderBy(desc(queueJobLog.createdAt))
    .limit(pageSize)
    .offset(pageIndex * pageSize)
}

// ── Worker 分派（业务函数）────────────────────────────────────────

type ProgressReporter = ((processed: number, total: number) => void) | null

/**
 * Meilisearch job 分派：按 payload.type 调用已滚动改造的 CronService 方法。
 * onProgress 把页级进度透传给 JobLogger（双写 PG + Redis）。
 */
async function runMeiliHandler(
  payload: TaskPayload,
  onProgress: ProgressReporter,
) {
  switch (payload.type) {
    case 'meili-game':
      return await CronService.meiliSearchAddIndex(onProgress ?? undefined)
    case 'meili-tag':
      return await CronService.meiliSearchAddTag(onProgress ?? undefined)
    case 'meili-producer':
      return await CronService.meiliSearchAddProducer(onProgress ?? undefined)
    default:
      throw new Error(`未知的 meili 任务类型: ${(payload as TaskPayload).type}`)
  }
}

/**
 * VNDB 数据同步分派。
 * 注意：`VndbSync.syncFull/syncDelta/syncProducersFromDb` 内部自带 Redis 分布式锁
 * 防重入（返回 undefined 表示锁被占用），队列 concurrency=1 再保证串行。
 */
async function runVndbHandler(
  payload: TaskPayload,
  onProgress: ProgressReporter,
) {
  switch (payload.type) {
    case 'vndb-full':
      return await VndbSync.syncFull(onProgress ?? undefined)
    case 'vndb-delta':
      return await VndbSync.syncDelta(onProgress ?? undefined)
    case 'vndb-producers':
      return await VndbSync.syncProducersFromDb(onProgress ?? undefined)
    default:
      throw new Error(`未知的 vndb 任务类型: ${(payload as TaskPayload).type}`)
  }
}

/** Kungal（NextMoe）目录数据同步分派。 */
async function runKungalHandler(
  payload: TaskPayload,
  onProgress: ProgressReporter,
) {
  switch (payload.type) {
    case 'kungal-full':
      return await KungalSync.syncFull(onProgress ?? undefined)
    case 'kungal-delta':
      return await KungalSync.syncDelta(onProgress ?? undefined)
    default:
      throw new Error(
        `未知的 kungal 任务类型: ${(payload as TaskPayload).type}`,
      )
  }
}

/** Cloudreve 文件→VNDB ID 同步分派。 */
async function runCloudreveHandler(payload: TaskPayload) {
  if (payload.type !== 'cloudreve-sync') {
    throw new Error(
      `未知的 cloudreve 任务类型: ${(payload as TaskPayload).type}`,
    )
  }
  return await CronService.cloudreveSyncScript()
}

/** 队列日志/记录 TTL 清理（分批物理删除，避免长事务锁表）。 */
async function runPruneHandler() {
  const logCutoff = new Date(Date.now() - QUEUE_LOG_TTL_DAYS * 86400_000)
  const jobCutoff = new Date(Date.now() - QUEUE_JOB_RETENTION_DAYS * 86400_000)

  // 先删子日志，再删 job（返回被删 id 列表用于计数）。
  const deletedLogs = await db
    .delete(queueJobLog)
    .where(lt(queueJobLog.createdAt, logCutoff))
    .returning({ id: queueJobLog.id })
  const deletedJobs = await db
    .delete(queueJob)
    .where(lt(queueJob.createdAt, jobCutoff))
    .returning({ id: queueJob.id })

  return {
    deletedLogs: deletedLogs.length,
    deletedJobs: deletedJobs.length,
  }
}

// ── 通用 Worker 包装器 ───────────────────────────────────────────

interface WorkerHandlerContext {
  jobId: string
  queue: string
  logger: JobLogger
}

interface QueueWorkerSpec {
  queue: (typeof QUEUE)[keyof typeof QUEUE]
  concurrency: number
  /** 任务执行主体；应返回结果（供 event 标记 completed + 记录 returnvalue）。 */
  run: (payload: TaskPayload, ctx: WorkerHandlerContext) => Promise<unknown>
  /** 执行成功后的收尾（如链式入队）。抛错只记日志，不污染主任务状态。 */
  onSuccess?: (result: unknown, ctx: WorkerHandlerContext) => Promise<void>
}

/**
 * 注册单个队列的 Worker，统一处理：
 * - 生命周期（running → completed / failed / dead-letter，由 queue events 驱动终态）；
 * - 失败自动重试语义（沿用 bun-queue attempts/backoff；耗尽后转 DLQ）；
 * - 进度回写（JobLogger 双写 PG + Redis）。
 */
function createWorker<T extends QueueWorkerSpec>(spec: T) {
  const { queue, concurrency, run, onSuccess } = spec
  const q = queueOf(queue)

  const worker = new Worker<TaskPayload>(q, concurrency, async (job) => {
    const logger = new JobLogger(job)
    const queueName = job.queue.name
    const ctx: WorkerHandlerContext = {
      jobId: job.id,
      queue: queueName,
      logger,
    }

    await TaskLifecycle.markRunning(job.id, queueName, job.data as TaskPayload)
    try {
      const result = await run(job.data as TaskPayload, ctx)
      // 链式收尾失败（如 cloudreve 后入队 vndb-delta 时 Redis 抖动）不影响主任务终态。
      if (onSuccess) {
        try {
          await onSuccess(result, ctx)
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          await logger.warn(
            `任务成功后收尾失败（已忽略，不影响主任务）: ${msg}`,
          )
        }
      }
      return result
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await logger.error(msg)

      // 终态判定：与 bun-queue Worker 内部的调度逻辑保持一致，避免中间态误标。
      const attemptsMade = job.attemptsMade + 1
      const maxAttempts = job.opts.attempts ?? 1
      const dlqOpts = q.getDefaultDeadLetterOptions()
      const dlqEnabled = dlqOpts?.enabled ?? false
      const dlqMax = dlqOpts?.maxRetries ?? 3
      const willDeadLetter = dlqEnabled && attemptsMade >= dlqMax
      const willRetry = !willDeadLetter && attemptsMade < maxAttempts

      if (willRetry) {
        await logger.warn(
          `第 ${attemptsMade}/${maxAttempts} 次执行失败，将自动重试`,
        )
      } else if (willDeadLetter) {
        await logger.warn(
          `第 ${attemptsMade} 次执行失败，已耗尽重试，转入死信队列`,
        )
        // 终态由 queue.events jobMovedToDeadLetter 写入 dead-letter，无需在此处理。
      } else {
        await TaskLifecycle.markFailed(job.id, msg)
      }
      throw e
    }
  })
  worker.start()
  return worker
}

/**
 * 启动前挂载：把 bun-queue 的终态事件翻译成 PG 的 galrc_queue_job 终态。
 * - jobCompleted            → completed（含 returnvalue）
 * - jobMovedToDeadLetter    → dead-letter
 * - jobRepublishedFromDeadLetter → queued（等待重新消费）
 * 这些是 Worker 内部在重试/死信决策「之后」发出的，作为唯一权威终态来源，
 * 避免在每次尝试的 catch 里误标 failed。
 */
function wireLifecycleEvents(q: Queue<TaskPayload>) {
  q.events.on('jobCompleted', (jobId, result) => {
    void TaskLifecycle.markCompleted(jobId, result ?? null).catch((e) =>
      console.warn(`[queue] markCompleted(${jobId}) 失败:`, e),
    )
  })
  q.events.on('jobMovedToDeadLetter', (jobId, _dlqName, reason) => {
    void TaskLifecycle.markDeadLetter(jobId, reason ?? '重试耗尽').catch((e) =>
      console.warn(`[queue] markDeadLetter(${jobId}) 失败:`, e),
    )
  })
  q.events.on('jobRepublishedFromDeadLetter', (jobId) => {
    void TaskLifecycle.markRequeued(jobId).catch((e) =>
      console.warn(`[queue] markRequeued(${jobId}) 失败:`, e),
    )
  })
}

// ── 分派表 ───────────────────────────────────────────────────────

/** 注册所有队列的 Worker 与定时任务（仅生产 + Redis 生效时调用，见 index.ts 挂载点）。 */
export async function startQueueWorkers() {
  if (!isQueueEnabled) {
    console.log('⏭️ Queue workers skipped: Redis not enabled (dev mode).')
    return
  }
  const workers: Worker<TaskPayload>[] = []
  const queues: Queue<TaskPayload>[] = []

  // VNDB 数据同步（串行：VNDB API 限流 + 全量/增量互斥）
  workers.push(
    createWorker({
      queue: QUEUE.vndbSync,
      concurrency: 1,
      run: (payload, { logger }) =>
        runVndbHandler(payload, (p, t) => {
          void logger.progress(percentOf(p, t))
        }),
    }),
  )

  // Kungal 目录数据同步（串行：与 vndb 独立，解析走 NextMoe 限流）
  workers.push(
    createWorker({
      queue: QUEUE.kungalSync,
      concurrency: 1,
      run: (payload, { logger }) =>
        runKungalHandler(payload, (p, t) => {
          void logger.progress(percentOf(p, t))
        }),
    }),
  )

  // Meilisearch 索引滚动同步（game/tag/producer 按类型分派，三类型隔离可并行）
  workers.push(
    createWorker({
      queue: QUEUE.meiliIndex,
      concurrency: 3,
      run: (payload, { logger }) =>
        runMeiliHandler(payload, (p, t) => {
          void logger.progress(percentOf(p, t))
        }),
    }),
  )

  // Cloudreve 文件→VNDB ID 同步（串行；完成后链式入队 vndb/kungal delta）
  workers.push(
    createWorker({
      queue: QUEUE.cloudreveSync,
      concurrency: 1,
      run: (payload) => runCloudreveHandler(payload),
      onSuccess: async (_result, { logger }) => {
        // 保留原有行为：云同步成功后紧跟一次 VNDB / Kungal 增量同步。
        // 独立 try/catch，链式入队失败只告警，绝不污染 cloudreve 任务的 completed 终态。
        try {
          await enqueue(QUEUE.vndbSync, { type: 'vndb-delta' })
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          await logger.warn(`链式入队 vndb-delta 失败（已忽略）: ${msg}`)
        }
        try {
          await enqueue(QUEUE.kungalSync, { type: 'kungal-delta' })
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          await logger.warn(`链式入队 kungal-delta 失败（已忽略）: ${msg}`)
        }
      },
    }),
  )

  // 队列日志/记录 TTL 清理（低频）
  workers.push(
    createWorker({
      queue: QUEUE.metrics,
      concurrency: 1,
      run: () => runPruneHandler(),
    }),
  )

  for (const q of [
    queueOf(QUEUE.vndbSync),
    queueOf(QUEUE.kungalSync),
    queueOf(QUEUE.meiliIndex),
    queueOf(QUEUE.cloudreveSync),
    queueOf(QUEUE.metrics),
  ]) {
    wireLifecycleEvents(q)
    queues.push(q)
  }

  // ── 启动对账：把上次进程异常退出遗留的 running 任务标记为 interrupted ──
  try {
    await TaskLifecycle.reconcileInterrupted()
  } catch (e) {
    console.warn('[queue] 启动对账失败（跳过）:', e)
  }

  // 清理历史遗留的 repeatable cron jobs：直接操作 Redis（ZREM delayed 成员 + DEL job hash），
  // 绕过 bun-queue removeJob —— 它对 zset 型 delayed 结构执行 LREM 必然 WRONGTYPE，
  // 且内部吞错打日志（每次启动刷屏），removeJob 路径不可用。
  // scheduleCron 在其后用固定 jobId 重新注册，删除旧成员是安全的（幂等去重）。
  for (const q of queues) {
    try {
      const client = getRedisClient()
      const delayedKey = `${QUEUE_PREFIX}:${q.name}:delayed`
      const members = (await client.send('ZRANGE', [
        delayedKey,
        '0',
        '-1',
      ])) as string[]
      for (const member of members) {
        const jobKey = `${QUEUE_PREFIX}:${q.name}:job:${member}`
        const fields = (await client.send('HGETALL', [jobKey])) as Record<
          string,
          string
        > | null
        let isRepeat = false
        try {
          const opts = fields?.opts ? JSON.parse(fields.opts) : null
          isRepeat = !!opts?.repeat
        } catch {
          isRepeat = false
        }
        if (!isRepeat) continue
        await client.send('ZREM', [delayedKey, member])
        await client.send('DEL', [jobKey])
        console.log(`[queue] 清理旧 cron job ${member} (${q.name})`)
      }
    } catch (e) {
      console.warn(`[queue] 清理 ${q.name} 旧 cron jobs 失败:`, e)
    }
  }

  // 清理历史残留的分布式锁：bun-queue 锁 key 形如 `galzy-queue:lock:job:<id>`，
  // 旧进程异常退出会残留（30s TTL），重启后 stalled checker 重试期间一直 acquire
  // 失败刷屏。启动时主动清一次，避免重启窗口的抢锁报错。
  await delKvPattern('galzy-queue:lock:*')

  // 定时任务调度（scheduleCron 替换 croner）：
  // - cloudreve 同步每 30 分钟
  // - meili 三索引每周日 3:00 滚动重建
  // - 队列日志/记录 TTL 清理每天 4:00
  // jobId 固定 → 重复注册幂等（addStandardJob 对同 id 走 handleDuplicatedJob 去重）。
  try {
    await queueOf(QUEUE.cloudreveSync).scheduleCron({
      jobId: 'cron:cloudreve-sync',
      cronExpression: '*/30 * * * *',
      data: { type: 'cloudreve-sync' } satisfies TaskPayload,
    })
    await queueOf(QUEUE.meiliIndex).scheduleCron({
      jobId: 'cron:meili-game',
      cronExpression: '0 3 * * 0',
      data: { type: 'meili-game' } satisfies TaskPayload,
    })
    await queueOf(QUEUE.meiliIndex).scheduleCron({
      jobId: 'cron:meili-tag',
      cronExpression: '0 3 * * 0',
      data: { type: 'meili-tag' } satisfies TaskPayload,
    })
    await queueOf(QUEUE.meiliIndex).scheduleCron({
      jobId: 'cron:meili-producer',
      cronExpression: '0 3 * * 0',
      data: { type: 'meili-producer' } satisfies TaskPayload,
    })
    await queueOf(QUEUE.metrics).scheduleCron({
      jobId: 'cron:queue-log-prune',
      cronExpression: '0 4 * * *',
      data: { type: 'queue-log-prune' } satisfies TaskPayload,
    })
  } catch (e) {
    console.error('[queue] scheduleCron 失败:', e)
  }

  console.log(`✅ Queue workers started (${workers.length} queues).`)
}

/** 优雅停止所有 Worker（进程退出前调用，可选）。 */
export async function stopQueueWorkers() {
  // worker 由 queue 持有；queue.close() 会 stop worker + stalled checker。
  // 注意：bun-queue close() 会关掉共享 redis client，多队列共用同一实例，
  // 进程退出前统一关闭即可，不逐个调 close。
}

export type { Job, Queue }
export { queueOf }
