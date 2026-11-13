import {
  type ActiveTaskLogger,
  db,
  queueJob,
  queueJobLog,
  runInTaskLogContext,
  sql,
  type TaskLogLevel,
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

/** 毫秒 → 可读耗时（日志用；长任务动辄几十分钟，毫秒数人类读不出来）。 */
function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '未知耗时'
  if (ms < 1000) return `${Math.round(ms)}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m${Math.round(seconds % 60)}s`
}

/**
 * 结果摘要（一行）：让日志本身能读懂这次任务干了什么。
 * 管理端「结果」tab 是全量 JSON，这里只收短摘要，过长（大对象）就干脆不写，
 * 免得把日志表灌成 result 的副本。
 */
function summarizeResult(result: unknown): string | null {
  if (result === null || result === undefined) return null
  if (typeof result !== 'object') {
    const text = String(result)
    return text.length <= 200 ? text : null
  }
  try {
    const text = JSON.stringify(result)
    return text.length <= 200 ? text : null
  } catch {
    return null
  }
}

/**
 * 日志器只需要「job id + 回写进度」两件事。
 *
 * 队列 Job 天然满足；进程内联执行（本地 dev 无 Worker）没有 Redis job，
 * 只给 id 即可——这样两条执行路径共用同一套落库/进度逻辑，不用写第二份。
 */
type LogJobRef = {
  id: string
  updateProgress?: (percent: number) => Promise<void>
}

/**
 * 任务日志器：把执行日志写入 galrc_queue_job_log，进度同步双写
 * galrc_queue_job.progress 与 bun-queue 的 job.progress（Redis，供 stalled/DLQ 语义）。
 *
 * 写库走内部串行链：业务层转发（libs/queue/task-context.ts 的 forwardTaskLogs）
 * 是 fire-and-forget，多条 insert 同时到达时靠它保证「表里的顺序 = 产生的顺序」。
 */
export class JobLogger implements ActiveTaskLogger {
  private readonly job: LogJobRef
  private writes: Promise<void> = Promise.resolve()
  /**
   * 终态已落库：关闭日志器。
   *
   * 业务层有 `void updateProgress(...)` 这类 fire-and-forget 写入，可能在任务
   * 结束之后才 resolve；关掉后这些迟到日志直接丢弃，避免「执行完成」后面还挂一行。
   */
  private closed = false

  constructor(job: LogJobRef) {
    this.job = job
  }

  get jobId(): string {
    return this.job.id
  }

  private write(level: TaskLogLevel, message: string): Promise<void> {
    if (this.closed) return Promise.resolve()
    const next = this.writes
      .then(async () => {
        if (this.closed) return
        await db.insert(queueJobLog).values({
          jobId: this.job.id,
          level,
          message,
        })
      })
      // 日志是旁路：写失败只告警，绝不能把失败分支的终态写库带崩
      // （那条路径一旦抛出，job 会停在 running 变成僵尸行）。
      .catch((e) => {
        console.warn(`[queue] 写任务日志失败 (${this.job.id}):`, e)
      })
    this.writes = next
    return next
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

  /** 任务终态已写库：不再接受迟到日志（见 closed 的注释）。 */
  close() {
    this.closed = true
  }

  /** 更新进度（0-100）：同时落 galrc_queue_job.progress 与 Redis job.progress。 */
  async progress(percent: number) {
    // 任务已终结：onProgress 是 fire-and-forget 调用的，迟到的回写会把 100 覆盖回去。
    if (this.closed) return
    const p = Math.max(0, Math.min(100, Math.round(percent)))
    const writes: Promise<unknown>[] = [
      db
        .update(queueJob)
        .set({ progress: p })
        .where(eq(queueJob.id, this.job.id)),
    ]
    // 内联执行没有 Redis job：跳过进度回写，只留 PG。
    if (this.job.updateProgress) {
      writes.push(this.job.updateProgress(p))
    }
    await Promise.all(writes)
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
  /**
   * 回收「停摆在 queued」的僵尸行。
   *
   * 起因：生产库出现过 status=queued、started_at 有值、finished_at=null 的行。
   * 这类行不归 reconcileInterrupted 管（它只看 running），Worker 也不会再碰它，
   * 于是永远挂在「排队中」，管理页一直飘红。根因是终态事件偶发缺失，
   * 已在 createWorker 里补了 dead-letter 兜底；对账这一步负责清理历史存量。
   *
   * 停摆有两种形态，必须都收：
   * ① Redis 里根本查不到这条 job（key 被清理 / 从未真正入队）→ 标 interrupted；
   * ② job 在 Redis 侧已经结束（finishedOn / failedReason 有值），但 PG 还停在
   *    queued —— 就是终态事件丢了。生产库里 mw2cbfguibyno98h28 正是第 ② 类：
   *    Redis 的 failed 列表里有它、failedReason 是「未知的 kungal 任务类型」，
   *    而 PG 一直显示排队中。只判 getJob 返回 null 抓不到这一类，而它才是真实
   *    出现过的那条，所以这里按 job 的实际结果补写终态（failed / completed）。
   *
   * Redis 不可用时整步跳过（对账不是关键路径，不能因此让启动失败）；
   * cron 注册的 repeatable job 的 jobId 形如 `cron:xxx`，它本来就不在
   * 普通 job key 里，必须跳过，否则每次重启都会把它们误标成 interrupted。
   */
  async reconcileQueuedZombies(): Promise<number> {
    // 逐条 getJob 是一次 Redis 往返，排队行数不可控（历史上一次全量同步会留下几百条），
    // 不设上限会把启动拖成分钟级。这里只处理最老的一段——僵尸本来就是老的，
    // 剩下的留给下一次重启继续清（每轮都能推进，不会卡死）。
    const rows = await db
      .select({ id: queueJob.id, queue: queueJob.queue })
      .from(queueJob)
      .where(eq(queueJob.status, 'queued'))
      .orderBy(asc(queueJob.createdAt))
      .limit(QUEUED_RECONCILE_LIMIT)
    if (rows.length === 0) return 0

    // job key 不在了（未真正入队 / 被清理）：无从得知结果，只能标中断。
    const orphanIds: string[] = []
    const staleInlineIds: string[] = []
    // 上个进程留下的内联行（见下方 inline 分支）：与上面分开写，
    // 因为「排队记录在队列中不存在」这句话对它们不成立，错误文案要如实。
    // job 在 Redis 侧已终结、PG 还停在 queued：按真实结果补写终态。
    const finished: {
      id: string
      failedReason?: string
      returnvalue: unknown
      inDeadLetter: boolean
    }[] = []
    // 队列 → 是否可查（Redis 不可用/该队列 ping 不通时整队列跳过）。
    const usable = new Map<string, boolean>()
    for (const row of rows) {
      // cron 任务没有普通 job key，按「Redis 查不到」判定必然误伤。
      if (row.id.startsWith(CRON_JOB_PREFIX)) continue
      // 内联任务也不在 Redis 里，但它的「没人接手」是确定的：对账只由
      // startQueueWorkers 触发（生产），而内联执行只在没有 Worker 的进程里发生
      // ——两件事不可能同时成立。所以走到这里的 inline 行一定是上个进程的遗留
      // （本机 dev 的库就是生产库，遗留行会堆在管理页），直接回收。
      if (row.id.startsWith(INLINE_JOB_PREFIX)) {
        staleInlineIds.push(row.id)
        continue
      }
      let ok = usable.get(row.queue)
      if (ok === undefined) {
        try {
          ok = await queueOf(
            row.queue as (typeof QUEUE)[keyof typeof QUEUE],
          ).ping()
        } catch {
          ok = false
        }
        usable.set(row.queue, ok)
      }
      if (!ok) continue
      try {
        const queue = queueOf(row.queue as (typeof QUEUE)[keyof typeof QUEUE])
        // bun-queue 的 getJob 内部吞掉异常返回 null，所以前面必须先 ping 成功，
        // 否则 Redis 抖动会被误判成「job 不存在」，把正常排队任务标成中断。
        const job = await queue.getJob(row.id)
        if (!job) {
          orphanIds.push(row.id)
          continue
        }
        // 判定「已终结」必须自己重算一遍，不能只看 finishedOn —— bun-queue 的
        // moveToFailed 无论后面重不重试都会写 finishedOn，光凭它会误伤正在
        // delayed 里等下一轮重试的任务（PG 这时可能还没写回 running）。
        // 这里复刻 Worker 的决策：重试耗尽 or 够 DLQ 阈值才算终结。
        if (!job.finishedOn) continue
        const attemptsMade = job.attemptsMade
        // 与 bun-queue 一致用 || 而非 ??：attempts=0 它按 1 次处理（死信重放的
        // job 就是 attempts=0，正因如此才会走完「不重试也不进 DLQ」的无事件分支）。
        const maxAttempts = job.opts.attempts || 1
        const dlqMax = queue.getDefaultDeadLetterOptions()?.maxRetries ?? 3
        if (attemptsMade < maxAttempts && attemptsMade < dlqMax) continue
        // 进过 DLQ 的要标 dead-letter 而不是 failed：管理端对两者的可操作项
        // 不一样（dead-letter 才能重放），标错会让用户的「重试」按钮消失。
        // DLQ 的 job 副本在独立 key 下，原 job key 仍在（bun-queue 只把它移出
        // failed 列表），所以只能按 DLQ 的 key 是否存在来判定。
        let inDeadLetter = false
        try {
          const dlqKey = `${QUEUE_PREFIX}:${queue.getDeadLetterQueue().getQueueName()}:${row.id}`
          inDeadLetter = await (queue.redisClient.exists(
            dlqKey,
          ) as Promise<boolean>)
        } catch {
          // 判不出来就当普通 failed：宁可少标 dead-letter，也不要给出错误的重放入口。
          inDeadLetter = false
        }
        finished.push({
          id: row.id,
          failedReason: job.failedReason,
          returnvalue: job.returnvalue,
          inDeadLetter,
        })
      } catch (e) {
        console.warn(`[queue] 对账查询 job ${row.id} 失败（跳过）:`, e)
      }
    }

    // 两类僵尸分开写：已经结束的那批要把 Redis 侧的真实结果带出来，
    // 只标 interrupted 会丢掉失败原因（线上那条的 failedReason 就是排查线索）。
    let repaired = 0
    for (const { id, failedReason, returnvalue, inDeadLetter } of finished) {
      try {
        const suffix = '（Redis 侧已结束，启动对账补写终态）'
        if (inDeadLetter) {
          await TaskLifecycle.markDeadLetter(
            id,
            `${failedReason ?? '重试耗尽'}${suffix}`,
          )
        } else if (failedReason) {
          await TaskLifecycle.markFailed(id, `${failedReason}${suffix}`)
        } else {
          await TaskLifecycle.markCompleted(id, returnvalue ?? null)
        }
        repaired += 1
      } catch (e) {
        console.warn(`[queue] 对账补写终态失败 ${id}（跳过）:`, e)
      }
    }

    if (orphanIds.length > 0) {
      await db
        .update(queueJob)
        .set({
          status: 'interrupted',
          finishedAt: new Date(),
          error: '排队记录在队列中已不存在（启动对账清理僵尸行）',
        })
        .where(inArray(queueJob.id, orphanIds))
      console.log(
        `[queue] 启动对账: ${orphanIds.length} 个 queued 僵尸行标记为 interrupted`,
      )
    }
    if (staleInlineIds.length > 0) {
      await db
        .update(queueJob)
        .set({
          status: 'interrupted',
          finishedAt: new Date(),
          error: '内联执行随进程退出而中断（非生产环境无 Worker，无需重排）',
        })
        .where(inArray(queueJob.id, staleInlineIds))
      console.log(
        `[queue] 启动对账: ${staleInlineIds.length} 个遗留内联行标记为 interrupted`,
      )
    }
    if (repaired > 0) {
      console.log(
        `[queue] 启动对账: ${repaired} 个 queued 行按 Redis 终态补写（failed/completed）`,
      )
    }
    return orphanIds.length + staleInlineIds.length + repaired
  },
}

/** 单轮 queued 对账处理的最大行数（每行一次 Redis 往返，见 reconcileQueuedZombies）。 */
const QUEUED_RECONCILE_LIMIT = 500

/* ─────────────────── 进程内联执行（无消费方时的兜底） ─────────────────── */

/**
 * 本进程是否注册了队列 Worker。
 *
 * 关键场景：本机 dev 的 .env 里 REDIS_ENABLED=true、REDIS_URL 指向共享生产 Redis，
 * 而 Worker 只在 NODE_ENV=production 启动（index.ts:119）。于是 enqueue 会把任务
 * 推进生产队列，被线上旧镜像的 Worker 领走 → 它不认识新类型 → 重试 3 次进 DLQ，
 * 用户侧表现是「点了没反应」。
 *
 * 所以入队前要先区分「有没有消费方」：没有就走进程内联执行，绝不把任务丢进
 * 别人的队列。
 */
let workerRunning = false

/** Worker 是否已在本进程启动（仅 startQueueWorkers 成功后置 true）。 */
export function isWorkerRunning(): boolean {
  return workerRunning
}

/**
 * 能否在本进程内联执行任务。
 *
 * 生产环境即使没有 Worker（Redis 短暂不可用导致启动失败）也必须保持原语义
 * （入队失败 → 明确报错），不能悄悄改成同步执行——线上没有队列消费链路，
 * 就地跑全量同步会把 HTTP 拖死。故内联路径只对非生产环境开放。
 */
function canRunInline(): boolean {
  return !workerRunning && process.env.NODE_ENV !== 'production'
}

/** 本进程正在跑的内联任务：type → jobId（同类型不重复启动）。 */
const inlineJobs = new Map<string, string>()

/**
 * 内联执行的 job id 前缀。
 *
 * 刻意不用 cron: 前缀（对账逻辑据此跳过 repeatable job），
 * 也不会与 bun-queue 的雪花 id 撞车；inline: 前缀让管理端一眼看出
 * 「这条记录没有 Redis job，删了也不会留下孤儿」。
 */
const INLINE_JOB_PREFIX = 'inline:'

/** 是否为内联任务的 job id（供删除/对账判断要不要碰 Redis）。 */
export function isInlineJobId(jobId: string): boolean {
  return jobId.startsWith(INLINE_JOB_PREFIX)
}

/**
 * cron 注册的 repeatable job 的固定 id 前缀（见 startQueueWorkers 的 scheduleCron）。
 * 这类 job 的实体在 scheduler zset 里、不在普通 job key 中，任何「按 job key
 * 判断是否存在」的对账都必须跳过它们。
 */
export const CRON_JOB_PREFIX = 'cron:'

/**
 * 进内联执行：fire-and-forget。
 *
 * 只等一条 INSERT（写 queued 记录）就返回，重活由后台 void 跑——kungal/vndb 全量
 * 要几十分钟，HTTP 等不起（Eden 会先超时）。代价是进程退出时未跑完的内联任务会中断，
 * 行停在 running，由启动对账标成 interrupted，与队列任务的处理口径一致。
 */
async function runInline(queueName: string, payload: TaskPayload) {
  const jobId = `${INLINE_JOB_PREFIX}${payload.type}:${Date.now()}`
  inlineJobs.set(payload.type, jobId)

  // 先落一条 queued 记录再返回：一次 INSERT 而已，换来「管理端立刻能看到这条任务」；
  // 与队列路径（add 之后 await markQueued）保持同一顺序，失败也能同步暴露给调用方。
  try {
    await TaskLifecycle.markQueued(queueName, payload, jobId)
  } catch (e) {
    // 落库失败就别占着去重槽位，否则同类型再也起不来。
    if (inlineJobs.get(payload.type) === jobId) inlineJobs.delete(payload.type)
    throw e
  }

  void (async () => {
    const logger = new JobLogger({ id: jobId })
    try {
      await TaskLifecycle.markRunning(jobId, queueName, payload)
      // 与 Worker 路径共用同一套任务上下文：业务层写进 siteConfig 进度的日志
      // 会被 forwardTaskLogs 桥接到本 job 的 galrc_queue_job_log。
      await runInTaskLogContext(logger, async () => {
        const startedAt = Date.now()
        await logger.info(`进程内联执行（本进程无 Worker）: ${payload.type}`)
        const result = await runTaskHandler(payload, (p, t) => {
          void logger.progress(percentOf(p, t))
        })
        const summary = summarizeResult(result)
        if (summary) await logger.info(`执行结果: ${summary}`)
        await TaskLifecycle.markCompleted(jobId, result ?? null)
        await logger.success(
          `执行完成，耗时 ${formatDuration(Date.now() - startedAt)}`,
        )
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // 终态兜底：内联路径没有 bun-queue 事件，失败必须自己写，
      // 否则行永远停在 running（正是生产上那条 queued 僵尸的成因）。
      try {
        await TaskLifecycle.markFailed(jobId, msg)
        await logger.error(msg)
      } catch (logError) {
        console.error('[queue] 内联任务终态写入失败:', logError)
      }
      console.error(`[queue] 内联任务失败 ${payload.type}:`, e)
    } finally {
      logger.close()
      // 只删除自己登记的那条：期间可能已有新的内联任务顶替。
      if (inlineJobs.get(payload.type) === jobId) {
        inlineJobs.delete(payload.type)
      }
    }
  })()

  return jobId
}

/**
 * 入队：校验白名单 → 写 galrc_queue_job 记录 → 放入 bun-queue，返回 job.id。
 *
 * 三条路径：
 * - 本进程有 Worker：正常入队（生产唯一路径，行为与改动前完全一致）；
 * - 无 Worker 且非生产（本机 dev）：进程内联执行，立刻返回 inline jobId；
 * - 生产且队列不可用：明确报错（保持原语义）。
 */
export async function enqueue(queueName: string, payload: TaskPayload) {
  if (!isValidTask(queueName, payload.type)) {
    throw status(400, `非法任务: queue=${queueName} type=${payload.type}`)
  }

  if (canRunInline()) {
    // 同类型已在跑：直接返回原 jobId，避免连点起两个全量同步。
    const running = inlineJobs.get(payload.type)
    if (running) return running
    return await runInline(queueName, payload)
  }

  if (!isQueueEnabled) {
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
  // 内联任务在 Redis 里根本不存在，removeJob 只会白发一次往返。
  if (isInlineJobId(jobId)) return
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
    // 前端据此提示「本进程就地执行」，而不是显示一条永远在「排队中」的记录：
    // 本地 dev 没有 Worker，任务确实不会进 Redis。
    workerRunning: isWorkerRunning(),
    inlineExecution: canRunInline(),
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

type TaskHandler = (
  payload: TaskPayload,
  onProgress: ProgressReporter,
) => Promise<unknown>

/**
 * 任务类型 → 执行函数（唯一分派真相）。
 *
 * 之前是四个 runXxxHandler 各自写 switch + default throw，与 QUEUE_TASKS 白名单
 * 形成两份并行真相：白名单新增类型时忘了加 case 也能编译通过，只会在运行时
 * 才炸成「未知的 kungal 任务类型」（生产上真出过一次 dead-letter）。
 * 现在用 satisfies Record<TaskPayload['type'], TaskHandler> 让类型系统兜住：
 * 白名单漏一个 handler 直接编译失败。
 *
 * 注：runPruneHandler 在本文件后面定义，函数声明会提升，此处引用是安全的。
 */
export const TASK_HANDLERS = {
  'vndb-full': (_payload, onProgress) =>
    VndbSync.syncFull(onProgress ?? undefined),
  'vndb-delta': (_payload, onProgress) =>
    VndbSync.syncDelta(onProgress ?? undefined),
  'vndb-producers': (_payload, onProgress) =>
    VndbSync.syncProducersFromDb(onProgress ?? undefined),
  'kungal-full': (_payload, onProgress) =>
    KungalSync.syncFull(onProgress ?? undefined),
  'kungal-delta': (_payload, onProgress) =>
    KungalSync.syncDelta(onProgress ?? undefined),
  'kungal-characters': (_payload, onProgress) =>
    KungalSync.syncCharacters(onProgress ?? undefined),
  'kungal-walkthroughs': (_payload, onProgress) =>
    KungalSync.syncWalkthroughs(onProgress ?? undefined),
  'meili-game': (_payload, onProgress) =>
    CronService.meiliSearchAddIndex(onProgress ?? undefined),
  'meili-tag': (_payload, onProgress) =>
    CronService.meiliSearchAddTag(onProgress ?? undefined),
  'meili-producer': (_payload, onProgress) =>
    CronService.meiliSearchAddProducer(onProgress ?? undefined),
  'cloudreve-sync': () => CronService.cloudreveSyncScript(),
  'queue-log-prune': () => runPruneHandler(),
} satisfies Record<TaskPayload['type'], TaskHandler>

/**
 * 类型前缀 → 族名。只服务于「未知类型」错误文案：原来的四条错误串
 * （未知的 vndb/kungal/meili/cloudreve 任务类型）是线上日志的检索锚点，
 * 合并分派表后不能丢，否则历史告警的 grep 会断。
 */
function taskFamilyOf(type: string): string {
  if (type.startsWith('vndb-')) return 'vndb'
  if (type.startsWith('kungal-')) return 'kungal'
  if (type.startsWith('meili-')) return 'meili'
  if (type.startsWith('cloudreve-')) return 'cloudreve'
  return type.split('-')[0] || type
}

/**
 * 统一分派：查表执行。
 *
 * 表用 satisfies 保证了编译期穷尽，但 payload 来自 Redis/DB（可能是旧镜像写入的
 * 历史类型），运行时仍要兜一层，避免脏 payload 把 Worker 打成未捕获异常。
 */
export async function runTaskHandler(
  payload: TaskPayload,
  onProgress: ProgressReporter,
) {
  const handler = (TASK_HANDLERS as Record<string, TaskHandler | undefined>)[
    payload.type
  ]
  if (!handler) {
    throw new Error(
      `未知的 ${taskFamilyOf(payload.type)} 任务类型: ${payload.type}`,
    )
  }
  return await handler(payload, onProgress)
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
 * 队列日志/记录的 TTL 清理（分批物理删除，避免长事务锁表）。
 *
 * 事件/下载明细（galrc_event_views / galrc_gameDownloadStats）不再在这里清理：
 * 统计已改为写时增量聚合（galrc_stat_windows），明细表不再有写入方，
 * 历史数据由 scripts/backfill-stat-windows.ts 一次性回填后 TRUNCATE。
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

  return { deletedLogs, deletedJobs }
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

/** 任务执行期间刷新 processedOn 的心跳间隔（bun-queue 的 stalled 判定阈值是 10s）。 */
const JOB_HEARTBEAT_MS = 5_000

/**
 * 任务执行心跳：定时刷新 Redis 里的 `processedOn`。
 *
 * 背景（bun-queue 0.1.8）：StalledJobChecker 判断「卡死」的唯一依据是
 * `processedOn` 是否超过 10 秒，而 processedOn 只在开始执行时写一次、
 * 没有任何续期机制。于是**任何执行超过约 10 秒的任务**都会在下一次检查
 * （默认每 30s）被判成 stalled → 从 active 挪回 waiting 重跑，最多
 * `maxStalledJobRetries`（默认 3）次。
 *
 * 表现为：长同步任务「执行完成」后立刻又出现「第 2/3/4 次尝试」，整轮
 * 上游请求与写库被重复执行，管理端日志里却没有任何失败原因 —— 重试不是
 * 业务失败引起的，是检查器误判。
 *
 * 用心跳刷新 processedOn 后：
 * - 正常的长任务不会再被误判（每次检查时年龄都 < 10s）；
 * - 进程崩溃/任务真的挂死时心跳停止，检查器仍能按原逻辑回收重试。
 */
function startJobHeartbeat(
  queue: Queue<TaskPayload>,
  jobId: string,
): () => void {
  const jobKey = queue.getJobKey(jobId)
  const timer = setInterval(() => {
    void queue.redisClient
      .send('HSET', [jobKey, 'processedOn', Date.now().toString()])
      .catch(() => {})
  }, JOB_HEARTBEAT_MS)
  // 心跳不能阻止进程退出
  ;(timer as unknown as { unref?: () => void }).unref?.()
  return () => clearInterval(timer)
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
    const payload = job.data as TaskPayload
    const ctx: WorkerHandlerContext = {
      jobId: job.id,
      queue: queueName,
      logger,
    }

    await TaskLifecycle.markRunning(job.id, queueName, payload)

    // 整条执行链包进任务上下文：业务层仍把日志写进 siteConfig 进度
    // （libs/queue/task-context.ts），由 forwardTaskLogs 桥接到本 job 的日志表。
    return await runInTaskLogContext(logger, async () => {
      const startedAt = Date.now()
      const attempt = (job.attemptsMade ?? 0) + 1
      // 心跳包住整次尝试（含开始日志）：避免长任务被 stalled 检查误判后整轮重跑
      const stopHeartbeat = startJobHeartbeat(q, job.id)
      try {
        await logger.info(
          `开始执行 ${payload.type}${attempt > 1 ? `（第 ${attempt} 次尝试）` : ''}`,
        )
        const result = await run(payload, ctx)
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
        const summary = summarizeResult(result)
        if (summary) await logger.info(`执行结果: ${summary}`)
        await logger.success(
          `执行完成，耗时 ${formatDuration(Date.now() - startedAt)}`,
        )
        return result
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        await logger.error(msg)

        // 终态判定必须逐条复刻 bun-queue Worker 的调度逻辑（dist 里 moveToFailed
        // 之后的 if 链），否则我们标的状态会和 Redis 里的实际去向不一致：
        //   maxAttempts = opts.attempts || 1        ← 是 || 不是 ??
        //   dlqEnabled  = opts.deadLetter ?? 队列默认  ← 先看单 job 覆盖
        //   dlqMax      = 单 job maxRetries || 队列默认 || 3
        // 我们的 handler 先于 moveToFailed 抛错，所以这里的 attemptsMade 要 +1
        // 才是库随后写进 hash 的值。
        const attemptsMade = job.attemptsMade + 1
        const maxAttempts = job.opts.attempts || 1
        const jobDlq = job.opts.deadLetter
        const dlqOpts = q.getDefaultDeadLetterOptions()
        const dlqEnabled =
          jobDlq !== undefined ? Boolean(jobDlq) : (dlqOpts?.enabled ?? false)
        const dlqMax =
          (typeof jobDlq === 'object' && jobDlq !== null
            ? jobDlq.maxRetries
            : dlqOpts?.maxRetries) || 3
        const willDeadLetter = dlqEnabled && attemptsMade >= dlqMax
        const willRetry = !willDeadLetter && attemptsMade < maxAttempts

        if (willDeadLetter) {
          await logger.warn(
            `第 ${attemptsMade} 次执行失败，已耗尽重试，转入死信队列`,
          )
          // 终态兜底：正常情况下由 queue.events 的 jobMovedToDeadLetter 写 dead-letter。
          // 这里直接写一次 —— 事件随后再来写同值，幂等无害。
          await TaskLifecycle.markDeadLetter(job.id, msg)
        } else if (willRetry) {
          await logger.warn(
            `第 ${attemptsMade}/${maxAttempts} 次执行失败，将自动重试`,
          )
        } else {
          // 第三档：既不再重试、也够不上 DLQ 阈值。bun-queue 在这一档什么都不做
          // ——不重试、不进 DLQ、**也不发任何事件**，job 就静静躺在 failed 列表里。
          // 线上那条 status=queued 的僵尸行就是这么来的：死信重放时 resetRetries
          // 把 attempts 置 0，库按 || 当 1 次算，第二次失败即落入本档。
          // 所以这一档必须我们自己写终态，否则 PG 永远停在 running/queued。
          await TaskLifecycle.markFailed(job.id, msg)
        }
        throw e
      } finally {
        stopHeartbeat()
        logger.close()
      }
    })
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
        runTaskHandler(payload, (p, t) => {
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
        runTaskHandler(payload, (p, t) => {
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
        runTaskHandler(payload, (p, t) => {
          void logger.progress(percentOf(p, t))
        }),
    }),
  )

  // Cloudreve 文件→VNDB ID 同步（串行；完成后链式入队 vndb/kungal delta）
  workers.push(
    createWorker({
      queue: QUEUE.cloudreveSync,
      concurrency: 1,
      run: (payload) => runTaskHandler(payload, null),
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
      run: (payload) => runTaskHandler(payload, null),
    }),
  )

  // 5 个 Worker 全部注册完之后才置位：enqueue 从此刻起必须走真正的队列。
  // 生产里 canRunInline() 本来就因为 NODE_ENV==='production' 恒 false，这里置位
  // 是给「非生产却主动起了 Worker」的场景（本地联调队列）保底，避免自我内联。
  workerRunning = true

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

  // ── 启动对账：回收上次进程异常退出遗留的非终态记录 ──
  // 1) running：进程没了，任务不会再有结果；
  // 2) queued 但 Redis 里已无该 job：终态事件偶发缺失留下的僵尸行。
  // 两步互不依赖，一步失败不影响另一步，也都不允许拦住启动。
  try {
    await TaskLifecycle.reconcileInterrupted()
  } catch (e) {
    console.warn('[queue] 启动对账（running）失败（跳过）:', e)
  }
  try {
    await TaskLifecycle.reconcileQueuedZombies()
  } catch (e) {
    console.warn('[queue] 启动对账（queued 僵尸）失败（跳过）:', e)
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
