import { Queue } from '@stacksjs/bun-queue'
import { isQueueEnabled, queueConnection } from './config'
import type { TaskPayload } from './payload'
import type { QueueName } from './types'

/**
 * QueueFactory —— 对 bun-queue 的薄封装，隔离第三方 0.x API。
 *
 * - 队列实例惰性创建（module 级缓存），与项目现有 redis/meili 的惰性风格一致。
 * - 仅在 isQueueEnabled（生产 + Redis 生效）时才真正连 Redis；否则 add 抛错，
 *   由调用方（路由层）降级为同步执行。
 * - 锁定第三方 API：业务代码只 import { queueOf } / { QUEUE }，不直接碰 bun-queue。
 */
const instances = new Map<QueueName, Queue<TaskPayload>>()

export function queueOf(name: QueueName): Queue<TaskPayload> {
  const cached = instances.get(name)
  if (cached) return cached

  if (!isQueueEnabled) {
    // dev 无 Redis：不创建队列。让 add() 之后的用法显式失败，路由层据此降级。
    throw new Error(`Queue ${name} is disabled (Redis not enabled)`)
  }

  const queue = new Queue<TaskPayload>(name, queueConnection())
  instances.set(name, queue)
  return queue
}

/** 判断队列系统是否启用（供路由层决定「入队 vs 同步执行」）。 */
export function queueAvailable(): boolean {
  return isQueueEnabled
}

export {
  defaultDeadLetterOptions,
  defaultJobOptions,
  isQueueEnabled,
  QUEUE_PREFIX,
  queueConnection,
} from './config'
export type { TaskPayload } from './payload'
export type { QueueName, QueueTaskMap, TaskType } from './types'
export { isValidTask, QUEUE, queueTaskTypes } from './types'
