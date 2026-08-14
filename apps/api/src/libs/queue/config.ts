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
    ...overrides,
  }
}

/**
 * 队列默认 JobOptions：失败重试 + 指数退避 + 完成后移除（减少 Redis 堆积）。
 * 各队列可在 worker 注册处按需覆盖。
 */
export const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: true,
  removeOnFail: 100,
} as const
