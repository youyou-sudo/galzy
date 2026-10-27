import {
  db,
  eventViews,
  gameDownloadStats,
  queueJob,
  queueJobLog,
  sql,
  statCounters,
} from '@api/libs'
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
  EVENT_VIEW_RETENTION_DAYS,
  GAME_DOWNLOAD_STATS_RETENTION_DAYS,
  QUEUE_JOB_RETENTION_DAYS,
  QUEUE_LOG_TTL_DAYS,
} from '@api/libs/queue/config'
import { QUEUE_TASKS } from '@api/libs/queue/types'
import { delKvPattern, getRedisClient } from '@api/libs/redis'
import { CronService } from '@api/modules/cron/service'
import { KungalSync } from '@api/modules/kungal-sync/service'
import { VndbSync } from '@api/modules/vndb-sync/service'
import { type Job, type Queue, Worker } from '@stacksjs/bun-queue'
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lt,
  or,
} from 'drizzle-orm'
import { status } from 'elysia'
import {
  isTerminalStatus,
  QUEUE_LABELS,
  QUEUE_WAIT_SLA_MINUTES,
  TASK_SORT_FIELDS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type TaskSortField,
  type TaskStatus,
  type TasksModel,
  TYPE_LABELS,
  TYPE_PRIORITY,
  TYPE_SLA_MINUTES,
} from './model'

/* ────────────────────────────── 公共工具 ────────────────────────────── */

/** 错误码 → HTTP 状态（前端只看到 message，码会被 BFF 编码进 message）。 */
function httpStatusOf(code: string): number {
  switch (code) {
    case 'TASK_NOT_FOUND':
    case 'DEAD_LETTER_NOT_FOUND':
      return 404
    case 'TASK_NOT_TERMINAL':
    case 'TASK_ALREADY_ACTIVE':
      return 409
    case 'QUEUE_UNAVAILABLE':
      return 503
    default:
      return 400
  }
}

/** 抛结构化业务错误：{ code, message } 作为响应体，HTTP 状态由码决定。 */
function fail(code: string, message: string): never {
  throw status(httpStatusOf(code), { code, message })
}

/** 单值 / 逗号串 / 数组 → 去重数组（Elysia 只在重复 key 时产出数组）。 */
function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return []
  const raw = Array.isArray(value) ? value : value.split(',')
  return [...new Set(raw.map((item) => item.trim()).filter(Boolean))]
}

/** LIKE 通配符转义：用户输入里的 % _ \ 必须当字面量。 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

/** 解析 ISO 时间，非法返回 null（由调用方决定 400 还是忽略）。 */
function parseDate(value: string | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

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

/** 队列名白名单校验：非法队列直接 400，而不是静默返回空数组。 */
function assertKnownQueue(queueName: string) {
  const known = Object.values(QUEUE) as string[]
  if (!known.includes(queueName)) {
    fail('INVALID_FILTER', `未知队列: ${queueName}`)
  }
  return queueName as (typeof QUEUE)[keyof typeof QUEUE]
}

export type DeadLetterJobRow = {
  id: string
  type: string
  failedReason: string | null
  attemptsMade: number
  stacktrace: string[]
  timestamp: number
}

/**
 * 死信列表（envelope）。
 *
 * bun-queue 没有 DLQ 计数 API，因此用「多取 1 条」判断 hasMore，
 * 不做 O(n) 全量计数（total 不返回）。
 */
export async function listDeadLetterJobs(
  queueName: string,
  pageSize: number,
  pageIndex: number,
) {
  const queue = assertKnownQueue(queueName)
  // pageIndex 是 0 基（前端 useInfiniteQuery 的 pageParam），page 是 1 基；
  // 写成 Math.max(1, pageIndex) 会让 pageIndex=1 仍落在第 1 页（「加载更多」重复行）。
  const page = Math.max(1, (Math.floor(pageIndex) || 0) + 1)
  const empty = {
    items: [] as DeadLetterJobRow[],
    page,
    pageSize,
    hasMore: false,
  }
  if (!isQueueEnabled) return empty

  const start = (page - 1) * pageSize
  const jobs = await queueOf(queue).getDeadLetterJobs(
    start,
    start + pageSize, // 闭区间：多取 1 条用于判断 hasMore
  )
  const hasMore = jobs.length > pageSize
  const pageJobs = (hasMore ? jobs.slice(0, pageSize) : jobs) as Array<{
    id: string
    name?: string
    data?: TaskPayload
    failedReason?: string
    attemptsMade?: number
    stacktrace?: string[]
    timestamp?: number
  }>
  return {
    items: pageJobs.map((job) => ({
      id: job.id,
      type: job.data?.type ?? job.name ?? 'unknown',
      failedReason: job.failedReason ?? null,
      attemptsMade: job.attemptsMade ?? 0,
      stacktrace: job.stacktrace ?? [],
      timestamp: job.timestamp ?? 0,
    })),
    page,
    pageSize,
    hasMore,
  }
}

/** 死信重放：重新入队原队列并重置 PG 状态（返回原 jobId）。 */
export async function republishDeadLetterJob(queueName: string, jobId: string) {
  const queue = assertKnownQueue(queueName)
  if (!isQueueEnabled) {
    fail('QUEUE_UNAVAILABLE', '队列不可用（Redis 未启用）')
  }
  const job = await queueOf(queue).republishDeadLetterJob(jobId, {
    resetRetries: true,
  })
  if (!job) fail('DEAD_LETTER_NOT_FOUND', `死信任务不存在: ${jobId}`)
  // PG 状态由 wireLifecycleEvents 的 jobRepublishedFromDeadLetter 事件重置；
  // 此处兜底（事件为异步发射，稳妥起见同步落一次）。
  await TaskLifecycle.markRequeued(jobId)
  return { ok: true as const, jobId }
}

/** 丢弃死信：从 DLQ 移除并同步删除 PG 记录。 */
export async function removeDeadLetterJob(queueName: string, jobId: string) {
  const queue = assertKnownQueue(queueName)
  if (!isQueueEnabled) {
    fail('QUEUE_UNAVAILABLE', '队列不可用（Redis 未启用）')
  }
  const ok = await queueOf(queue).removeDeadLetterJob(jobId)
  if (!ok) fail('DEAD_LETTER_NOT_FOUND', `死信任务不存在: ${jobId}`)
  await db.delete(queueJob).where(eq(queueJob.id, jobId))
  return { ok: true as const, removed: true }
}

/** 死信批量的单项结果（批量接口永远 HTTP 200，逐项回报）。 */
export type BatchOpResult = {
  id: string
  ok: boolean
  code?: string
  message?: string
}

/** 批量重放：逐项独立，已不存在的计入失败而不是整体 404。 */
export async function batchRepublishDeadLetterJobs(
  queueName: string,
  jobIds: string[],
) {
  const results: BatchOpResult[] = []
  for (const jobId of jobIds) {
    try {
      await republishDeadLetterJob(queueName, jobId)
      results.push({ id: jobId, ok: true })
    } catch {
      results.push({
        id: jobId,
        ok: false,
        code: 'DEAD_LETTER_NOT_FOUND',
        message: '死信任务不存在或已被处理',
      })
    }
  }
  const succeeded = results.filter((item) => item.ok).length
  return {
    ok: true as const,
    requested: jobIds.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  }
}

/** 批量丢弃。 */
export async function batchRemoveDeadLetterJobs(
  queueName: string,
  jobIds: string[],
) {
  const results: BatchOpResult[] = []
  for (const jobId of jobIds) {
    try {
      await removeDeadLetterJob(queueName, jobId)
      results.push({ id: jobId, ok: true })
    } catch {
      results.push({
        id: jobId,
        ok: false,
        code: 'DEAD_LETTER_NOT_FOUND',
        message: '死信任务不存在或已被处理',
      })
    }
  }
  const succeeded = results.filter((item) => item.ok).length
  return {
    ok: true as const,
    requested: jobIds.length,
    removed: succeeded,
    missing: results.filter((item) => !item.ok).map((item) => item.id),
    results,
  }
}

/* ───────────────────────── 写操作（门控 + 可复用单项逻辑） ───────────────────────── */

/** 单条写操作的结果形状：批量接口直接复用它，避免 try/catch 解析 HTTP 错误。 */
export type WriteOpResult = {
  ok: boolean
  code?: string
  message?: string
  jobId?: string
}

/** 从 Redis 摘除任务（尽力而为：失败不阻断 PG 删除）。 */
async function detachFromQueue(jobId: string, queueName: string) {
  if (!isQueueEnabled) return
  try {
    await queueOf(queueName as (typeof QUEUE)[keyof typeof QUEUE]).removeJob(
      jobId,
    )
  } catch {
    // 任务可能已被移除或队列不可用，忽略
  }
}

/**
 * 删除单条记录的纯逻辑（不抛错）。
 *
 * 门控：只有终态可删；非终态必须显式 force（先 removeJob 再删记录），
 * 避免管理员误删运行中的全量同步后「记录消失但任务还在跑」。
 */
async function deleteOne(
  jobId: string,
  force: boolean,
): Promise<WriteOpResult & { deleted?: boolean }> {
  const rows = await db
    .select()
    .from(queueJob)
    .where(eq(queueJob.id, jobId))
    .limit(1)
  const job = rows[0]
  if (!job) {
    return {
      ok: false,
      code: 'TASK_NOT_FOUND',
      message: `任务不存在: ${jobId}`,
    }
  }
  if (!force && !isTerminalStatus(job.status)) {
    return {
      ok: false,
      code: 'TASK_NOT_TERMINAL',
      message: `运行中/排队中的任务不可删除（当前: ${job.status}）`,
    }
  }

  await detachFromQueue(jobId, job.queue)

  // 日志与任务在同一事务内删除：避免「日志删了、任务还在」的孤儿状态。
  await db.transaction(async (tx) => {
    await tx.delete(queueJobLog).where(eq(queueJobLog.jobId, jobId))
    await tx.delete(queueJob).where(eq(queueJob.id, jobId))
  })
  return { ok: true, deleted: true }
}

/** 删除任务记录（默认仅终态；force=true 才允许删运行中/排队中的记录）。 */
export async function deleteJob(jobId: string, force = false) {
  const result = await deleteOne(jobId, force)
  if (!result.ok)
    fail(result.code ?? 'TASK_NOT_FOUND', result.message ?? '删除失败')
  return { ok: true as const, deleted: true as const }
}

/**
 * 批量删除：逐项判定，HTTP 永远 200。
 *
 * 只有终态行会被真正删除；非终态进入 failed（409 语义），不存在的进入 missing。
 * 事务只包住「已确认可删」的那一批，一条非法不会拖垮整批。
 */
export async function batchDeleteJobs(jobIds: string[]) {
  const unique = [...new Set(jobIds)]
  if (unique.length === 0) {
    return {
      ok: true as const,
      requested: 0,
      deleted: 0,
      missing: [],
      failed: [],
    }
  }

  const rows = await db
    .select({ id: queueJob.id, queue: queueJob.queue, status: queueJob.status })
    .from(queueJob)
    .where(inArray(queueJob.id, unique))
  const existing = new Map(rows.map((row) => [row.id, row]))
  const deletable = rows.filter((row) => isTerminalStatus(row.status))
  const missing = unique.filter((id) => !existing.has(id))
  const failed = rows
    .filter((row) => !isTerminalStatus(row.status))
    .map((row) => ({
      id: row.id,
      code: 'TASK_NOT_TERMINAL',
      message: `非终态不可删除（当前: ${row.status}）`,
    }))

  if (deletable.length > 0) {
    for (const row of deletable) await detachFromQueue(row.id, row.queue)
    const ids = deletable.map((row) => row.id)
    await db.transaction(async (tx) => {
      await tx.delete(queueJobLog).where(inArray(queueJobLog.jobId, ids))
      await tx.delete(queueJob).where(inArray(queueJob.id, ids))
    })
  }

  return {
    ok: true as const,
    requested: unique.length,
    deleted: deletable.length,
    missing,
    failed,
  }
}

/** 同 queue+type 是否已有活跃任务（重试的并发保护）。 */
async function findActiveJob(queue: string, type: string) {
  const rows = await db
    .select({ id: queueJob.id })
    .from(queueJob)
    .where(
      and(
        eq(queueJob.queue, queue),
        eq(queueJob.type, type),
        inArray(queueJob.status, ['queued', 'running']),
      ),
    )
    .limit(1)
  return rows[0]?.id ?? null
}

/**
 * 重试单条（不抛错）。
 *
 * - 死信走 DLQ 重放（保留原 jobId，mode=republish）；
 * - 其余重新入队（新 jobId，mode=requeue）；
 * - 同 queue+type 已有活跃任务时拒绝（409），避免连点造成多个全量同步。
 */
async function retryOne(
  jobId: string,
): Promise<WriteOpResult & { mode?: 'requeue' | 'republish' }> {
  const rows = await db
    .select()
    .from(queueJob)
    .where(eq(queueJob.id, jobId))
    .limit(1)
  const job = rows[0]
  if (!job) {
    return {
      ok: false,
      code: 'TASK_NOT_FOUND',
      message: `任务不存在: ${jobId}`,
    }
  }
  if (!['failed', 'dead-letter', 'interrupted'].includes(job.status)) {
    return {
      ok: false,
      code: 'TASK_NOT_RETRYABLE',
      message: `仅失败/死信/中断的任务可重试（当前: ${job.status}）`,
    }
  }

  const payload = (job.payload ?? {}) as TaskPayload
  if (!payload.type) {
    return {
      ok: false,
      code: 'PAYLOAD_MISSING_TYPE',
      message: `任务缺少 payload 类型，无法重试: ${jobId}`,
    }
  }

  if (job.status === 'dead-letter') {
    try {
      const result = await republishDeadLetterJob(job.queue, jobId)
      return { ok: true, jobId: result.jobId, mode: 'republish' }
    } catch {
      return {
        ok: false,
        code: 'DEAD_LETTER_NOT_FOUND',
        message: '死信任务不存在或已被处理',
      }
    }
  }

  const active = await findActiveJob(job.queue, job.type)
  if (active) {
    return {
      ok: false,
      code: 'TASK_ALREADY_ACTIVE',
      message: `同类型任务正在执行（${active}），请等待完成后再重试`,
    }
  }

  const newJobId = await enqueue(job.queue, payload)
  return { ok: true, jobId: newJobId, mode: 'requeue' }
}

/** 重试失败/中断/死信任务（单条，错误抛给路由层）。 */
export async function retryJob(jobId: string) {
  const result = await retryOne(jobId)
  if (!result.ok) {
    fail(result.code ?? 'TASK_NOT_RETRYABLE', result.message ?? '重试失败')
  }
  return { ok: true as const, jobId: result.jobId, mode: result.mode }
}

/** 批量重试：逐项独立结果，部分失败不整体回滚。 */
export async function batchRetryJobs(jobIds: string[]) {
  const unique = [...new Set(jobIds)]
  const results: Array<{
    id: string
    ok: boolean
    mode?: 'requeue' | 'republish'
    jobId?: string
    code?: string
    message?: string
  }> = []
  for (const id of unique) {
    const result = await retryOne(id)
    results.push({
      id,
      ok: result.ok,
      mode: result.mode,
      jobId: result.jobId,
      code: result.code,
      message: result.message,
    })
  }
  const succeeded = results.filter((item) => item.ok).length
  return {
    ok: true as const,
    requested: unique.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  }
}

/* ────────────────────────────── 列表查询 V2 ────────────────────────────── */

const SORT_COLUMNS = {
  createdAt: queueJob.createdAt,
  startedAt: queueJob.startedAt,
  finishedAt: queueJob.finishedAt,
  status: queueJob.status,
  type: queueJob.type,
} as const

/** 所有白名单任务类型（用于 types 参数校验）。 */
const ALL_TASK_TYPES = Object.values(QUEUE_TASKS).flat() as string[]

/** 所有已知队列（用于 queues 参数校验）。 */
const ALL_QUEUES = Object.values(QUEUE) as string[]

/**
 * 逾期判定（SQL 侧，与前端 sla.ts 的规则一一对应）：
 * - queued 且创建超过 QUEUE_WAIT_SLA_MINUTES → 滞留；
 * - running 且已跑超过该类型的 SLA 分钟数 → 逾期；
 * - 终态永不逾期。
 * 类型分钟数来自 TYPE_SLA_MINUTES（服务端常量，非用户输入，可安全内联）。
 */
const TYPE_SLA_CASE = sql.raw(
  `(CASE "type" ${Object.entries(TYPE_SLA_MINUTES)
    .map(([type, minutes]) => `WHEN '${type}' THEN ${Number(minutes)}`)
    .join(' ')} ELSE 60 END)`,
)

const OVERDUE_CONDITION = sql`(
  ("status" = 'queued' AND "created_at" < now() - make_interval(mins => ${QUEUE_WAIT_SLA_MINUTES}))
  OR ("status" = 'running' AND "started_at" < now() - make_interval(mins => ${TYPE_SLA_CASE}))
)`

/** 列表项投影：不含 payload/result 两个 jsonb（详情接口才返回）。 */
export type TaskListItem = {
  id: string
  queue: string
  type: string
  status: TaskStatus
  progress: number
  error: string | null
  startedAt: Date | null
  finishedAt: Date | null
  createdAt: Date
}

/** 分面计数：六个状态 key 恒存在（缺失补 0），保证前端徽标不会闪 undefined。 */
function emptyCounts(): Record<TaskStatus, number> {
  return TASK_STATUSES.reduce(
    (acc, key) => {
      acc[key] = 0
      return acc
    },
    {} as Record<TaskStatus, number>,
  )
}

/**
 * 任务列表 V2。
 *
 * 设计要点：
 * 1. 多值参数取并集、去重、白名单校验（非法值 400 INVALID_FILTER）；
 * 2. 排序白名单 + id 稳定二级键，避免同毫秒创建导致分页漂移；
 * 3. counts 是「除状态外」的分面：点任意状态后 total === counts[status]；
 * 4. 列表只回 8 个标量字段，error 截断到 500 字符。
 */
export async function listJobsV2(input: TasksModel.listQuery) {
  const pageSize = Math.min(Math.max(input.pageSize ?? 20, 1), 100)
  // page（1 基）优先于 pageIndex（0 基）
  const page = input.page ?? (input.pageIndex ?? 0) + 1
  if (!Number.isInteger(page) || page < 1) {
    fail('VALIDATION_ERROR', 'page 必须为正整数')
  }
  const offset = (page - 1) * pageSize

  const statuses = [
    ...new Set([
      ...toArray(input.statuses),
      ...(input.status ? [input.status] : []),
    ]),
  ]
  const queues = [
    ...new Set([
      ...toArray(input.queues),
      ...(input.queue ? [input.queue] : []),
    ]),
  ]
  const types = [
    ...new Set([...toArray(input.types), ...(input.type ? [input.type] : [])]),
  ]

  const badStatus = statuses.filter(
    (value) => !(TASK_STATUSES as readonly string[]).includes(value),
  )
  if (badStatus.length > 0) {
    fail('INVALID_FILTER', `非法状态: ${badStatus.join(', ')}`)
  }
  const badQueue = queues.filter((value) => !ALL_QUEUES.includes(value))
  if (badQueue.length > 0) {
    fail('INVALID_FILTER', `未知队列: ${badQueue.join(', ')}`)
  }
  const badType = types.filter((value) => !ALL_TASK_TYPES.includes(value))
  if (badType.length > 0) {
    fail('INVALID_FILTER', `未知任务类型: ${badType.join(', ')}`)
  }

  const dateFrom = parseDate(input.dateFrom)
  if (input.dateFrom && !dateFrom) {
    fail('INVALID_DATE_RANGE', `dateFrom 不是合法时间: ${input.dateFrom}`)
  }
  const dateTo = parseDate(input.dateTo)
  if (input.dateTo && !dateTo) {
    fail('INVALID_DATE_RANGE', `dateTo 不是合法时间: ${input.dateTo}`)
  }
  if (dateFrom && dateTo && dateFrom >= dateTo) {
    fail('INVALID_DATE_RANGE', 'dateFrom 必须早于 dateTo')
  }

  const keyword = input.q?.trim()
  if (keyword && keyword.length > 100) {
    fail('VALIDATION_ERROR', 'q 最长 100 个字符')
  }
  const like = keyword ? `%${escapeLike(keyword)}%` : undefined

  // 分面（base）条件：不含状态，供 counts 使用
  const baseConditions = [
    queues.length > 0 ? inArray(queueJob.queue, queues) : undefined,
    types.length > 0 ? inArray(queueJob.type, types) : undefined,
    like
      ? or(
          ilike(queueJob.id, like),
          ilike(queueJob.type, like),
          ilike(queueJob.error, like),
        )
      : undefined,
    dateFrom ? gte(queueJob.createdAt, dateFrom) : undefined,
    dateTo ? lt(queueJob.createdAt, dateTo) : undefined,
    input.overdue ? OVERDUE_CONDITION : undefined,
  ].filter(
    (condition): condition is NonNullable<typeof condition> =>
      condition !== undefined,
  )
  const baseWhere = baseConditions.length ? and(...baseConditions) : undefined

  // 列表与 total 用的最终条件：base + 状态（含「仅可重试」这个状态别名）
  const effectiveStatuses =
    statuses.length > 0
      ? statuses
      : input.retryable
        ? ['failed', 'dead-letter', 'interrupted']
        : []
  const finalWhere =
    effectiveStatuses.length > 0
      ? baseConditions.length > 0
        ? and(...baseConditions, inArray(queueJob.status, effectiveStatuses))
        : inArray(queueJob.status, effectiveStatuses)
      : baseWhere

  const sortKey = (input.sort ?? 'createdAt') as TaskSortField
  if (!(TASK_SORT_FIELDS as readonly string[]).includes(sortKey)) {
    fail('INVALID_SORT', `不支持的排序字段: ${input.sort}`)
  }
  const direction = input.order ?? 'desc'
  const sortColumn = SORT_COLUMNS[sortKey]
  // NULLS LAST：排队中任务的 startedAt/finishedAt 为 NULL，默认 DESC 会把它们顶到最前
  const orderBy = [
    sql`${sortColumn} ${sql.raw(direction)} nulls last`,
    sql`${queueJob.id} ${sql.raw(direction)}`,
  ]

  const withCounts = input.withCounts !== false

  const [items, totalRow, facetRows] = await Promise.all([
    db
      .select({
        id: queueJob.id,
        queue: queueJob.queue,
        type: queueJob.type,
        status: queueJob.status,
        progress: queueJob.progress,
        error: sql<string | null>`left(${queueJob.error}, 500)`,
        startedAt: queueJob.startedAt,
        finishedAt: queueJob.finishedAt,
        createdAt: queueJob.createdAt,
      })
      .from(queueJob)
      .where(finalWhere)
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() }).from(queueJob).where(finalWhere),
    withCounts
      ? db
          .select({ status: queueJob.status, count: count() })
          .from(queueJob)
          .where(baseWhere)
          .groupBy(queueJob.status)
      : Promise.resolve(null),
  ])

  const counts = emptyCounts()
  if (facetRows) {
    for (const row of facetRows) {
      counts[row.status as TaskStatus] = row.count
    }
  }

  const total = totalRow[0]?.count ?? 0

  return {
    items: items as TaskListItem[],
    total,
    page,
    pageIndex: page - 1,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    counts: withCounts ? counts : undefined,
    applied: {
      q: keyword ?? null,
      queues,
      types,
      statuses: effectiveStatuses,
      dateFrom: input.dateFrom ?? null,
      dateTo: input.dateTo ?? null,
      overdue: !!input.overdue,
      retryable: !!input.retryable,
      sort: sortKey,
      order: direction,
    },
  }
}

/**
 * 任务字典（前端筛选器与标签的唯一来源）。
 *
 * 队列/类型/优先级/保留期全部由服务端下发，消灭前端硬编码字典漂移
 * （重构前旧任务页里有两份手写映射）。
 */
export async function getTaskMeta() {
  return {
    queues: ALL_QUEUES.map((key) => {
      const tasks =
        (QUEUE_TASKS as Record<string, readonly string[]>)[key] ?? []
      return {
        key,
        label: QUEUE_LABELS[key] ?? key,
        tasks: tasks.map((type) => ({
          type,
          label: TYPE_LABELS[type] ?? type,
          priority: TYPE_PRIORITY[type] ?? 'P2',
        })),
      }
    }),
    statuses: TASK_STATUSES.map((key) => ({
      key,
      label: TASK_STATUS_LABELS[key],
    })),
    priorities: TYPE_PRIORITY,
    slaMinutes: TYPE_SLA_MINUTES,
    queueWaitSlaMinutes: QUEUE_WAIT_SLA_MINUTES,
    retentionDays: QUEUE_JOB_RETENTION_DAYS,
    queueEnabled: isQueueEnabled,
  }
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

export type QueueStatsRow = {
  queue: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: number
  /** 数据来源：redis = 实时；disabled = Redis 未启用（数字全 0） */
  source: 'redis' | 'disabled'
}

/**
 * 各队列实时状态（来自 bun-queue Redis 计数）。
 *
 * 现状是 5 个队列串行 5 次 Redis 往返，2s 轮询下成本明显；这里改并发 + 单项容错，
 * 单个队列 Redis 抖动不再拖垮整张卡片。
 */
export async function getQueueStats(): Promise<QueueStatsRow[]> {
  const queues = Object.values(QUEUE) as (typeof QUEUE)[keyof typeof QUEUE][]
  const zero = (name: string, source: 'redis' | 'disabled'): QueueStatsRow => ({
    queue: name,
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
    paused: 0,
    source,
  })

  if (!isQueueEnabled) return queues.map((name) => zero(name, 'disabled'))

  return await Promise.all(
    queues.map(async (name) => {
      try {
        const counts = await queueOf(name).getJobCounts()
        return {
          queue: name,
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          completed: counts.completed ?? 0,
          failed: counts.failed ?? 0,
          delayed: counts.delayed ?? 0,
          paused: counts.paused ?? 0,
          source: 'redis' as const,
        }
      } catch {
        return zero(name, 'disabled')
      }
    }),
  )
}

export async function getJobDetail(jobId: string) {
  const rows = await db
    .select()
    .from(queueJob)
    .where(eq(queueJob.id, jobId))
    .limit(1)
  return rows[0] ?? null
}

export type JobLogRow = {
  id: number
  jobId: string
  level: string
  message: string
  createdAt: Date
}

/**
 * 任务日志（增量轮询）。
 *
 * - 带 afterId：只取 id 更大的行（升序），返回 nextAfterId，前端按游标追加；
 * - 不带 afterId：取最近 limit 条，反转为升序返回（控制台从上往下读）。
 * 相比现状「每 2s 重取 200 条」，终态任务与长日志的流量都降一个量级。
 */
export async function getJobLogs(jobId: string, query: TasksModel.logsQuery) {
  const limit = Math.min(Math.max(query.limit ?? 200, 1), 500)
  const levelCondition = query.level
    ? eq(queueJobLog.level, query.level)
    : undefined

  if (query.afterId !== undefined) {
    const conditions = [
      eq(queueJobLog.jobId, jobId),
      gt(queueJobLog.id, query.afterId),
      levelCondition,
    ].filter(
      (condition): condition is NonNullable<typeof condition> =>
        condition !== undefined,
    )
    const rows = await db
      .select()
      .from(queueJobLog)
      .where(and(...conditions))
      .orderBy(asc(queueJobLog.id))
      .limit(limit)
    const items = rows as JobLogRow[]
    return {
      items,
      nextAfterId: items.at(-1)?.id ?? query.afterId,
    }
  }

  const conditions = [eq(queueJobLog.jobId, jobId), levelCondition].filter(
    (condition): condition is NonNullable<typeof condition> =>
      condition !== undefined,
  )
  const rows = await db
    .select()
    .from(queueJobLog)
    .where(and(...conditions))
    .orderBy(desc(queueJobLog.id))
    .limit(limit)
  const items = (rows as JobLogRow[]).reverse()
  return { items, nextAfterId: items.at(-1)?.id ?? null }
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

/** 单批删除行数：既控制事务/锁的粒度，也避免一次性把全部被删 id 拉进内存。 */
const PRUNE_BATCH_SIZE = 5000

/**
 * 按 id 分批物理删除（避免长事务锁表、避免一次性加载全部被删行）。
 * `idCol` 必需是单列主键（serial 或 varchar 均可），用于 `IN (...)` 定位批；
 * 两张表的 id 类型不同（number / string），故此处用 any 收敛签名，调用处仍传具体表与列。
 */
async function pruneByBatch(
  table: any,
  idCol: any,
  timeCol: any,
  cutoff: Date,
): Promise<number> {
  let deleted = 0
  for (;;) {
    const rows = await db
      .select({ id: idCol })
      .from(table)
      .where(lt(timeCol, cutoff))
      .limit(PRUNE_BATCH_SIZE)
    if (rows.length === 0) break
    const removed = await db
      .delete(table)
      .where(
        inArray(
          idCol,
          rows.map((r) => r.id),
        ),
      )
      .returning({ id: idCol })
    deleted += removed.length
    // 行数不足一批，或本批未删掉任何行（并发已删），都结束循环。
    if (removed.length === 0) break
    if (rows.length < PRUNE_BATCH_SIZE) break
  }
  return deleted
}

/**
 * 分批删除过期事件明细，并把每批删除的行按 (event_type, target_id) 聚合进
 * galrc_stat_counters。删除与聚合在同一条语句（CTE）里完成，要么都生效要么都回滚，
 * 因此「累计值 = counters.total + 明细剩余行数」不会因并发/中途失败而重复计数。
 */
async function rollupAndPruneEventViews(cutoff: Date): Promise<number> {
  let deleted = 0
  for (;;) {
    const res = await db.execute(sql`
      WITH batch AS (
        SELECT id FROM ${eventViews}
        WHERE ${eventViews.createdAt} < ${cutoff}
        ORDER BY ${eventViews.id}
        LIMIT ${PRUNE_BATCH_SIZE}
      ),
      moved AS (
        DELETE FROM ${eventViews} e
        USING batch b
        WHERE e.id = b.id
        RETURNING e.event_type AS kind, e.target_id AS target_id
      ),
      rolled AS (
        INSERT INTO ${statCounters} (kind, target_id, total, updated_at)
        SELECT kind, target_id, COUNT(*), now() FROM moved GROUP BY kind, target_id
        ON CONFLICT (kind, target_id)
        DO UPDATE SET total = ${statCounters}.total + EXCLUDED.total, updated_at = now()
        RETURNING 1
      )
      SELECT (SELECT COUNT(*) FROM moved)::int AS removed
    `)
    const removed = Number((res as Array<{ removed: number }>)[0]?.removed ?? 0)
    if (removed === 0) break
    deleted += removed
    if (removed < PRUNE_BATCH_SIZE) break
  }
  return deleted
}

/** 分批删除过期下载明细并 rollup 进 counters（kind = 'game_download'）。 */
async function rollupAndPruneGameDownloads(cutoff: Date): Promise<number> {
  let deleted = 0
  for (;;) {
    const res = await db.execute(sql`
      WITH batch AS (
        SELECT id FROM ${gameDownloadStats}
        WHERE ${gameDownloadStats.createdAt} < ${cutoff}
        ORDER BY ${gameDownloadStats.id}
        LIMIT ${PRUNE_BATCH_SIZE}
      ),
      moved AS (
        DELETE FROM ${gameDownloadStats} d
        USING batch b
        WHERE d.id = b.id
        RETURNING d.game_id AS target_id
      ),
      rolled AS (
        INSERT INTO ${statCounters} (kind, target_id, total, updated_at)
        SELECT 'game_download', target_id, COUNT(*), now() FROM moved GROUP BY target_id
        ON CONFLICT (kind, target_id)
        DO UPDATE SET total = ${statCounters}.total + EXCLUDED.total, updated_at = now()
        RETURNING 1
      )
      SELECT (SELECT COUNT(*) FROM moved)::int AS removed
    `)
    const removed = Number((res as Array<{ removed: number }>)[0]?.removed ?? 0)
    if (removed === 0) break
    deleted += removed
    if (removed < PRUNE_BATCH_SIZE) break
  }
  return deleted
}

/**
 * 队列日志/记录 + 事件/下载明细的 TTL 清理（分批物理删除，避免长事务锁表）。
 * 明细清理前先 rollup 进 galrc_stat_counters，保证累计统计不因清理而下降。
 */
async function runPruneHandler() {
  const logCutoff = new Date(Date.now() - QUEUE_LOG_TTL_DAYS * 86400_000)
  const jobCutoff = new Date(Date.now() - QUEUE_JOB_RETENTION_DAYS * 86400_000)

  // 先删子日志，再删 job（FK ON DELETE CASCADE 只是兜底，显式顺序更清晰）。
  const deletedLogs = await pruneByBatch(
    queueJobLog,
    queueJobLog.id,
    queueJobLog.createdAt,
    logCutoff,
  )
  const deletedJobs = await pruneByBatch(
    queueJob,
    queueJob.id,
    queueJob.createdAt,
    jobCutoff,
  )

  // 明细清理（保留天数 <= 0 视为关闭）
  const deletedEventViews =
    EVENT_VIEW_RETENTION_DAYS > 0
      ? await rollupAndPruneEventViews(
          new Date(Date.now() - EVENT_VIEW_RETENTION_DAYS * 86400_000),
        )
      : 0
  const deletedDownloadStats =
    GAME_DOWNLOAD_STATS_RETENTION_DAYS > 0
      ? await rollupAndPruneGameDownloads(
          new Date(Date.now() - GAME_DOWNLOAD_STATS_RETENTION_DAYS * 86400_000),
        )
      : 0

  return {
    deletedLogs,
    deletedJobs,
    deletedEventViews,
    deletedDownloadStats,
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
