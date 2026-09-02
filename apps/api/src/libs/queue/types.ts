import type { TaskPayload } from './payload'

/**
 * 队列名与任务类型约定。
 *
 * 队列名用于 bun-queue 的 `new Queue(name)`；Redis key 统一带 `galzy-queue` 前缀
 * （见 config.ts）。一个队列承载多个任务类型，任务类型存入 payload.type，由
 * `queueJob` 表与日志/进度接口按 queue + type 区分。
 */
export const QUEUE = {
  /** VNDB 数据同步（full / delta / producers），VNDB API 限流 → 串行 */
  vndbSync: 'galzy:vndb-sync',
  /** Kungal（NextMoe）目录数据同步（full / delta） */
  kungalSync: 'galzy:kungal-sync',
  /** Meilisearch 索引滚动同步（game / tag / producer），三类型隔离可并行 */
  meiliIndex: 'galzy:meili-index',
  /** Cloudreve 文件→VNDB ID 同步 */
  cloudreveSync: 'galzy:cloudreve-sync',
  /** Cloudflare Worker 指标拉取 + 队列日志清理（低频） */
  metrics: 'galzy:metrics',
} as const

export type QueueName = (typeof QUEUE)[keyof typeof QUEUE]

/**
 * 队列 → 允许的任务类型白名单（唯一权威来源）。
 * enqueue 与 POST /tasks/enqueue 据此校验，杜绝 type 拼接任意值。
 */
export const QUEUE_TASKS = {
  [QUEUE.vndbSync]: ['vndb-full', 'vndb-delta', 'vndb-producers'],
  [QUEUE.kungalSync]: ['kungal-full', 'kungal-delta'],
  [QUEUE.meiliIndex]: ['meili-game', 'meili-tag', 'meili-producer'],
  [QUEUE.cloudreveSync]: ['cloudreve-sync'],
  [QUEUE.metrics]: ['queue-log-prune'],
} as const satisfies Record<QueueName, readonly TaskPayload['type'][]>

export type QueueTaskMap = typeof QUEUE_TASKS

/** 该队列允许的所有任务类型。 */
export function queueTaskTypes(queue: QueueName): readonly string[] {
  return QUEUE_TASKS[queue]
}

/** 校验 (queue, type) 是否为白名单内的合法组合。 */
export function isValidTask(queue: string, type: string): boolean {
  const tasks = (QUEUE_TASKS as Record<string, readonly string[]>)[queue]
  return Array.isArray(tasks) && (tasks as readonly string[]).includes(type)
}

export type TaskType = TaskPayload['type']
