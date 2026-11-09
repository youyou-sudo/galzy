import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * 任务执行上下文（AsyncLocalStorage）。
 *
 * 背景：任务调度搬到 bun-queue 之后，任务日志的**权威存储**是
 * `galrc_queue_job_log`（管理端 `/admin/tasks` 详情抽屉的「日志」tab 只读这张表），
 * 由 `modules/tasks/service.ts` 的 `JobLogger` 写入。
 *
 * 但业务层（`VndbSync` / `KungalSync` / `CronService`）的同步函数是队列改造**之前**写的：
 * 日志仍然写在 `galrc_siteConfig` 的进度 JSON 里（`xxxProgress.logs`，最多 100 条），
 * 那些只有旧的同步页读得到。于是队列化之后，任务跑完能拿到状态/结果，**日志却是空的**
 * ——线上库实测 214 个 job 只有 19 行日志，且全部是 warn/error（成功任务零日志），
 * 正是本文件要补的那一环。
 *
 * 这里提供两件事，且都不改动业务函数签名（否则要穿透十几个内部方法）：
 * 1) `runInTaskLogContext`：Worker / 内联执行把整条执行链包进上下文，暴露当前 job 的日志器；
 * 2) `forwardTaskLogs`：业务层写进度日志时，把**新增**条目顺带转发到当前 job 的日志表。
 *
 * 上下文只覆盖「任务执行」这一条异步链，与同进程里并发的 HTTP 请求天然隔离；
 * 没有任务在跑时 `getActiveTaskLogger()` 返回 undefined，业务层照旧只写 siteConfig。
 */

export type TaskLogLevel = 'info' | 'warn' | 'error' | 'success'

/**
 * 当前任务日志器的结构化子集。
 *
 * 刻意不直接 import `JobLogger`：它在 `modules/tasks` 里，而业务模块也要用本文件，
 * 反向依赖会形成 libs → modules 的循环。这里只约定鸭子类型，`JobLogger` 结构上兼容。
 */
export interface ActiveTaskLogger {
  readonly jobId: string
  info(message: string): Promise<void> | void
  warn(message: string): Promise<void> | void
  error(message: string): Promise<void> | void
  success(message: string): Promise<void> | void
}

/** 业务层日志条目：三个进度 JSON 的 `logs` 元素形状（level 各自只用到 info/error/success）。 */
export interface LegacyTaskLogEntry {
  time?: string
  level?: string
  message?: string
}

interface TaskLogContext {
  logger: ActiveTaskLogger
  /** 上下文建立时刻（毫秒）；早于它的条目属于上一轮执行，绝不转发。 */
  startedAtMs: number
  /** 已转发条目的去重键，避免 `addLog` 反复回传整段数组时重复写库。 */
  forwarded: Set<string>
}

const storage = new AsyncLocalStorage<TaskLogContext>()

/**
 * 在任务上下文里执行 `run`。
 *
 * 每个 job 每次尝试各建一份上下文：重试时新上下文的时间水位会过滤掉上一次尝试
 * 已经写过的业务日志，避免同一 job 的重试日志互相串。
 */
export function runInTaskLogContext<T>(
  logger: ActiveTaskLogger,
  run: () => Promise<T>,
): Promise<T> {
  return storage.run(
    { logger, startedAtMs: Date.now(), forwarded: new Set() },
    run,
  )
}

/**
 * 当前任务的日志器（没有任务在跑时为 undefined）。
 *
 * 供「想直接写日志」的业务代码使用；只是把已有进度日志桥接过去的话用
 * forwardTaskLogs 就够了。
 */
export function getActiveTaskLogger(): ActiveTaskLogger | undefined {
  return storage.getStore()?.logger
}

function normalizeLevel(level: string | undefined): TaskLogLevel {
  return level === 'warn' || level === 'error' || level === 'success'
    ? level
    : 'info'
}

/**
 * 业务层进度日志 → 当前 job 的 `galrc_queue_job_log`。
 *
 * - 只转发「本次执行开始之后」的条目：进度 JSON 里还留着一轮的历史日志，
 *   靠时间去水位过滤，不需要业务层自己算增量；
 * - 同一 `time|level|message` 只写一次：`addLog` 每次都会回传整段数组，必须去重；
 * - 写库失败/未在任务上下文 → 静默跳过：转发是旁路，不能影响同步任务本身。
 */
export function forwardTaskLogs(
  entries: readonly LegacyTaskLogEntry[] | null | undefined,
): void {
  if (!entries || entries.length === 0) return
  const context = storage.getStore()
  if (!context) return

  for (const entry of entries) {
    const message = entry?.message
    if (!message) continue

    const time = entry.time ? Date.parse(entry.time) : Number.NaN
    if (!Number.isNaN(time) && time < context.startedAtMs) continue

    const key = `${entry.time ?? ''}|${entry.level ?? ''}|${message}`
    if (context.forwarded.has(key)) continue
    context.forwarded.add(key)

    const level = normalizeLevel(entry.level)
    // 不 await：业务侧的 updateProgress 已经 await 了自己的写库，这里再等一次只会
    // 拖慢同步；JobLogger 内部串行写队列保证落表顺序，写失败也由它自己吞掉。
    void Promise.resolve(context.logger[level](message)).catch(() => {})
  }
}
