import { db, queueJob, queueJobLog } from '@api/libs'
import type { TaskPayload } from '@api/libs/queue'
import {
  defaultJobOptions,
  isQueueEnabled,
  QUEUE,
  queueOf,
} from '@api/libs/queue'
import {
  QUEUE_JOB_RETENTION_DAYS,
  QUEUE_LOG_TTL_DAYS,
} from '@api/libs/queue/config'
import { CronService } from '@api/modules/cron/service'
import { VndbSync } from '@api/modules/vndb-sync/service'
import { type Queue, Worker } from '@stacksjs/bun-queue'
import { and, desc, eq, lt } from 'drizzle-orm'

/**
 * 任务日志器：把执行日志写入 galrc_queue_job_log，进度同步写入
 * galrc_queue_job.progress 与 bun-queue 的 job.progress。
 *
 * 阶段 A 提供骨架；阶段 B 的 Worker handler 通过本 logger 上报，
 * 替代现状 CronService.updateMeiliProgress/addMeiliLog 与 VndbSync.updateProgress/addLog。
 */
export class JobLogger {
  constructor(private readonly jobId: string) {}

  private async write(
    level: 'info' | 'warn' | 'error' | 'success',
    message: string,
  ) {
    await db.insert(queueJobLog).values({ jobId: this.jobId, level, message })
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

  /** 更新进度（百分比 0-100，落库；绝对数由调用方存 queueJob.result）。 */
  async progress(percent: number) {
    const p = Math.max(0, Math.min(100, Math.round(percent)))
    await db
      .update(queueJob)
      .set({ progress: p })
      .where(eq(queueJob.id, this.jobId))
  }
}

/** 生命周期钩子：任务入队 / 开始 / 完成 / 失败时维护 galrc_queue_job 状态。 */
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
  async markRunning(jobId: string) {
    await db
      .update(queueJob)
      .set({ status: 'running', startedAt: new Date() })
      .where(eq(queueJob.id, jobId))
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
}

/** 入队：写 galrc_queue_job 记录 + 放入 bun-queue，返回 job.id。 */
export async function enqueue(queueName: string, payload: TaskPayload) {
  // dev 无 Redis（决策 1）：不启动队列，手动触发按类型同步执行，便于本地调试。
  if (!isQueueEnabled) {
    if (payload.type.startsWith('meili-')) {
      await runMeiliHandler(payload)
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

  const rows = await db
    .select()
    .from(queueJob)
    .where(where)
    .orderBy(desc(queueJob.createdAt))
    .limit(input.pageSize)
    .offset(input.pageIndex * input.pageSize)

  return rows
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

/**
 * Meilisearch job 分派：按 payload.type 调用已滚动改造的 CronService 方法。
 * 成功返回结果（{ code: 200 }），失败抛出原错误（由外层 handler 标记 failed + 重试）。
 */
async function runMeiliHandler(payload: TaskPayload) {
  switch (payload.type) {
    case 'meili-game':
      return await CronService.meiliSearchAddIndex()
    case 'meili-tag':
      return await CronService.meiliSearchAddTag()
    case 'meili-producer':
      return await CronService.meiliSearchAddProducer()
    default:
      throw new Error(`未知的 meili 任务类型: ${(payload as TaskPayload).type}`)
  }
}

/**
 * VNDB 数据同步分派。
 * 注意：`VndbSync.syncFull/syncDelta/syncProducersFromDb` 内部自带 Redis 分布式锁
 * 防重入（返回 undefined 表示锁被占用），队列 concurrency=1 再保证串行。
 */
async function runVndbHandler(payload: TaskPayload) {
  switch (payload.type) {
    case 'vndb-full':
      return await VndbSync.syncFull()
    case 'vndb-delta':
      return await VndbSync.syncDelta()
    case 'vndb-producers':
      return await VndbSync.syncProducersFromDb()
    default:
      throw new Error(`未知的 vndb 任务类型: ${(payload as TaskPayload).type}`)
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

/**
 * 注册所有队列的 Worker 与定时任务（仅生产 + Redis 生效时调用，见 index.ts 挂载点）。
 *
 * 阶段 A：handler 为占位实现，仅记录日志并标记完成；
 * 阶段 B：替换为对 CronService / VndbSync 的真实调用。
 */
export async function startQueueWorkers() {
  if (!isQueueEnabled) {
    console.log('⏭️ Queue workers skipped: Redis not enabled (dev mode).')
    return
  }
  const workers: Worker<TaskPayload>[] = []

  // VNDB 数据同步（串行：VNDB API 限流 + 全量/增量互斥）
  const vndbQueue = queueOf(QUEUE.vndbSync)
  workers.push(
    new Worker<TaskPayload>(vndbQueue, 1, async (job) => {
      const logger = new JobLogger(job.id)
      await TaskLifecycle.markRunning(job.id)
      try {
        const result = await runVndbHandler(job.data)
        await logger.success(`vndb ${job.data.type} 完成`)
        await TaskLifecycle.markCompleted(job.id, result ?? null)
        return result
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        await logger.error(msg)
        await TaskLifecycle.markFailed(job.id, msg)
        throw e
      }
    }),
  )

  // Meilisearch 索引滚动同步（game/tag/producer 按类型分派，三类型隔离可并行）
  const meiliQueue = queueOf(QUEUE.meiliIndex)
  workers.push(
    new Worker<TaskPayload>(meiliQueue, 3, async (job) => {
      const logger = new JobLogger(job.id)
      await TaskLifecycle.markRunning(job.id)
      try {
        const result = await runMeiliHandler(job.data)
        await logger.success(`meili ${job.data.type} 完成`)
        await TaskLifecycle.markCompleted(job.id, result)
        return result
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        await logger.error(msg)
        await TaskLifecycle.markFailed(job.id, msg)
        throw e
      }
    }),
  )

  // Cloudreve 文件→VNDB ID 同步（串行；完成后链式入队 vndb-delta）
  const cloudreveQueue = queueOf(QUEUE.cloudreveSync)
  workers.push(
    new Worker<TaskPayload>(cloudreveQueue, 1, async (job) => {
      const logger = new JobLogger(job.id)
      await TaskLifecycle.markRunning(job.id)
      try {
        const result = await runCloudreveHandler(job.data)
        await logger.success(`cloudreve ${job.data.type} 完成`)
        await TaskLifecycle.markCompleted(job.id, result ?? null)
        // 保留原有行为：云同步成功后紧跟一次 VNDB 增量同步（显式入队，失败可观测）。
        await enqueue(QUEUE.vndbSync, { type: 'vndb-delta' })
        return result
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        await logger.error(msg)
        await TaskLifecycle.markFailed(job.id, msg)
        throw e
      }
    }),
  )

  // Cloudflare 指标拉取 + 队列日志清理
  const metricsQueue = queueOf(QUEUE.metrics)
  workers.push(
    new Worker<TaskPayload>(metricsQueue, 1, async (job) => {
      const logger = new JobLogger(job.id)
      await TaskLifecycle.markRunning(job.id)
      try {
        const result =
          job.data.type === 'queue-log-prune'
            ? await runPruneHandler()
            : await CronService.workerDataPull()
        await logger.success(`metrics ${job.data.type} 完成`)
        await TaskLifecycle.markCompleted(job.id, result ?? null)
        return result
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        await logger.error(msg)
        await TaskLifecycle.markFailed(job.id, msg)
        throw e
      }
    }),
  )

  for (const w of workers) w.start()

  // 定时任务调度（scheduleCron 替换 croner）：
  // - workerDataPull 每分钟
  // - cloudreve 同步每 30 分钟
  // - meili 三索引每周日 3:00 滚动重建
  // - 队列日志/记录 TTL 清理每天 4:00
  try {
    await metricsQueue.scheduleCron({
      cronExpression: '*/1 * * * *',
      data: { type: 'worker-data-pull' } satisfies TaskPayload,
    })
    await cloudreveQueue.scheduleCron({
      cronExpression: '*/30 * * * *',
      data: { type: 'cloudreve-sync' } satisfies TaskPayload,
    })
    await meiliQueue.scheduleCron({
      cronExpression: '0 3 * * 0',
      data: { type: 'meili-game' } satisfies TaskPayload,
    })
    await meiliQueue.scheduleCron({
      cronExpression: '0 3 * * 0',
      data: { type: 'meili-tag' } satisfies TaskPayload,
    })
    await meiliQueue.scheduleCron({
      cronExpression: '0 3 * * 0',
      data: { type: 'meili-producer' } satisfies TaskPayload,
    })
    await metricsQueue.scheduleCron({
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
  // 阶段 A 暂无持有 worker 引用聚合；由 bun-queue close() 处理。占位。
}

export type { Queue }
export { queueOf }
