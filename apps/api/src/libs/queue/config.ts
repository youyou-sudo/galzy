import { getRedisClient, isRedisEnabled } from '@api/libs/redis'
import type { QueueConnectionConfig } from '@stacksjs/bun-queue'
/**
 * 队列 Redis key 前缀。与业务缓存/锁（`galzy:*`）同源但独立前缀，
 * 避免 `delKvPattern('galzy:*')` 之类操作误清队列数据。
 */
export const QUEUE_PREFIX = 'galzy-queue'

/**
 * 任务日志/记录的保留天数（PostgreSQL 侧 TTL，非 Redis EXPIRE）。
 * 详见 db/schema/task-log.ts 与 metrics 队列的 queue-log-prune 任务。
 */
export const QUEUE_LOG_TTL_DAYS = Number(process.env.QUEUE_LOG_TTL_DAYS ?? 14)
export const QUEUE_JOB_RETENTION_DAYS = Number(
  process.env.QUEUE_JOB_RETENTION_DAYS ?? 90,
)

/**
 * 队列是否可用：仅生产环境（Redis 生效）才启用。
 * 决策：dev 无 Redis 时不启动队列、不启动 cron；手动触发降级为同步执行。
 */
export const isQueueEnabled = isRedisEnabled

/**
 * 构建 bun-queue 的连接配置，复用项目现有的 Bun 内置 redis 实例
 * （`redis from 'bun'`），零 ioredis、零新运行时依赖。
 */
export function queueConnection(
  overrides?: Partial<QueueConnectionConfig>,
): QueueConnectionConfig {
  return {
    driver: 'redis',
    redis: { client: getRedisClient() },
    prefix: QUEUE_PREFIX,
    // 死信放连接级（对 scheduleCron 的 repeatable job 也生效——重试耗尽即进 DLQ）；
    // defaultJobOptions 仍在 enqueue() 调用点合并，避免给 cron 任务带上 attempts/removeOnComplete。
    defaultDeadLetterOptions,
    ...overrides,
  }
}

/**
 * 队列默认 JobOptions：失败重试 + 指数退避 + 完成后移除。
 * 重试耗尽进入死信（defaultDeadLetterOptions），failed 列表只留最近 100 条便于回溯。
 */
export const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: true,
  removeOnFail: 100,
} as const

/**
 * 队列默认死信配置：重试耗尽后自动移入 `<queue>-dead-letter` 队列，
 * 并从原 failed 列表移除（DLQ 自持副本，避免原队列污染）。
 */
export const defaultDeadLetterOptions = {
  enabled: true,
  maxRetries: 3,
  removeFromOriginalQueue: true,
} as const
