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
  /** Meilisearch 索引滚动同步（game / tag / producer），三类型隔离可并行 */
  meiliIndex: 'galzy:meili-index',
  /** Cloudreve 文件→VNDB ID 同步 */
  cloudreveSync: 'galzy:cloudreve-sync',
  /** Cloudflare Worker 指标拉取 + 队列日志清理（低频） */
  metrics: 'galzy:metrics',
} as const

export type QueueName = (typeof QUEUE)[keyof typeof QUEUE]

export type TaskType = TaskPayload['type']
