import { createHash } from 'node:crypto'
import { redis } from 'bun'

const isProduction = process.env.NODE_ENV === 'production'

// 开发模式（NODE_ENV !== 'production'）下 Redis 默认不生效：
// 缓存直查 DB、锁 / 幂等直接放行，无需本地 Redis 即可跑通全流程。
// 如需在本地调试缓存，可设 REDIS_ENABLED=true 强制开启。
export const isRedisEnabled =
  process.env.REDIS_ENABLED !== undefined
    ? process.env.REDIS_ENABLED === 'true'
    : isProduction

const redisLog = {
  debug: (...args: unknown[]) => {
    if (!isProduction) console.debug(...args)
  },
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
}

// ============================================================
// Redis client factory (configurable, mockable in tests)
// ============================================================

let activeClient: typeof redis | null = null

/**
 * 获取 Redis 客户端实例
 * 默认返回 Bun 内置的默认客户端；可通过 setRedisClient 在测试时替换
 */
export function getRedisClient(): typeof redis {
  return activeClient ?? redis
}

/**
 * 设置自定义 Redis 客户端（用于测试 mock）
 */
export function setRedisClient(client: typeof redis | null): void {
  activeClient = client
}

// ============================================================
// Safe operation helper
// ============================================================

const safeRedisOp = async <T>(
  op: (client: typeof redis) => Promise<T>,
  fallback: T,
  operationName: string,
): Promise<T> => {
  if (!isRedisEnabled) {
    redisLog.debug(
      `[Redis] ${operationName} skipped: redis disabled (dev mode)`,
    )
    return fallback
  }
  const client = getRedisClient()
  if (!client) {
    redisLog.warn(
      `[Redis] ${operationName} skipped: redis client not initialized`,
    )
    return fallback
  }
  try {
    return await op(client)
  } catch (err) {
    redisLog.error(`[Redis] ${operationName} failed:`, err)
    return fallback
  }
}

// ============================================================
// Lua script: atomically release a lock only if value matches
// ============================================================

const LOCK_RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1]
then
  return redis.call("del", KEYS[1])
else
  return 0
end
`

const LOCK_RELEASE_SCRIPT_SHA1 = createHash('sha1')
  .update(LOCK_RELEASE_SCRIPT)
  .digest('hex')

// ============================================================
// KV operations
// ============================================================

/**
 * 设置 Key-Value 对，并可选设置过期时间
 * @param key 键
 * @param value 值
 * @param time 过期时间（秒），如果不传则永久有效
 */
export const setKv = async (key: string, value: string, time?: number) => {
  const truncatedKey = key.length > 64 ? `${key.slice(0, 64)}...` : key
  return safeRedisOp(
    (client) =>
      (time
        ? client.setex(key, time, value)
        : client.set(key, value)) as Promise<string | undefined>,
    undefined,
    `setKv(${truncatedKey})`,
  )
}

/**
 * 获取 Key 对应 TTL
 * @param key 键
 */
export const getKvTime = async (key: string) => {
  return safeRedisOp(
    (client) => client.ttl(key) as Promise<number>,
    undefined,
    `getKvTime(${key})`,
  )
}

/**
 * 获取 Key 对应的值
 * @param key 键
 * @returns 对应的值，如果 Key 不存在则返回 null
 */
export const getKv = async (key: string) => {
  return safeRedisOp(
    async (client) => {
      const start = Date.now()
      const value = await client.get(key)
      const elapsed = Date.now() - start
      redisLog.debug(
        `[Redis] getKv(${key}) ${value !== null ? 'HIT' : 'MISS'} (${elapsed}ms)`,
      )
      return value
    },
    null,
    `getKv(${key})`,
  )
}

/**
 * 删除 Key
 * @param key 键
 * @returns 被删除的 Key 数量
 */
export const delKv = async (key: string) => {
  return safeRedisOp(
    (client) => client.del(key) as Promise<number>,
    0,
    `delKv(${key})`,
  )
}

/**
 * 根据模式删除 Key（基于 SCAN 迭代，避免生产环境阻塞）
 * @param pattern 模式，例如 "session:*" 将删除所有以 "session:" 开头的 Key
 * @returns 被删除的 Key 数量
 */
export const delKvPattern = async (pattern: string) => {
  return safeRedisOp(
    async (client) => {
      let cursor = '0'
      let deletedCount = 0
      do {
        const result = await client.send('SCAN', [
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          '100',
        ])
        const [nextCursor, keys] = result as [string, string[]]
        cursor = nextCursor
        if (keys.length > 0) {
          deletedCount += (await client.del(...keys)) as number
        }
      } while (cursor !== '0')
      redisLog.debug(
        `[Redis] delKvPattern(${pattern}) completed: deleted ${deletedCount} keys`,
      )
      return deletedCount
    },
    0,
    `delKvPattern(${pattern})`,
  )
}

/**
 * 尝试获取分布式锁
 * @param lockKey 锁的 Key
 * @param lockValue 锁的值（通常是唯一标识）
 * @param lockTimeoutMs 锁的过期时间（毫秒）
 * @returns 是否成功获取锁
 */
export const acquireLockKv = async (
  lockKey: string,
  lockValue: string,
  lockTimeoutMs: number,
) => {
  // 开发模式 Redis 不生效：单实例无并发竞争，直接视为已获得锁
  if (!isRedisEnabled) return true
  return safeRedisOp(
    async (client) => {
      const result = await client.send('SET', [
        lockKey,
        lockValue,
        'PX',
        lockTimeoutMs.toString(),
        'NX',
      ])
      const success = result === 'OK'
      redisLog.debug(
        `[Redis] acquireLockKv(${lockKey}) ${success ? 'acquired' : 'failed'}`,
      )
      return success
    },
    false,
    `acquireLockKv(${lockKey})`,
  )
}

/**
 * 释放分布式锁（EVALSHA 优先，失败时回退 EVAL）
 * @param key 锁的 Key
 * @param value 锁的值（必须与获取锁时使用的值相同）
 * @returns 是否成功释放锁
 */
export const releaseLockKv = async (key: string, value: string) => {
  // 开发模式 Redis 不生效：直接视为释放成功
  if (!isRedisEnabled) return true
  return safeRedisOp(
    async (client) => {
      try {
        const result = await client.send('EVALSHA', [
          LOCK_RELEASE_SCRIPT_SHA1,
          '1',
          key,
          value,
        ])
        const ok = result === 1 || result === 1n
        redisLog.debug(
          `[Redis] releaseLockKv(${key}) ${ok ? 'released' : 'failed (value mismatch)'}`,
        )
        return ok
      } catch (innerErr: any) {
        if (String(innerErr).includes('NOSCRIPT')) {
          // LUA script not cached on this server node, fall back to EVAL
          const result = await client.send('EVAL', [
            LOCK_RELEASE_SCRIPT,
            '1',
            key,
            value,
          ])
          const ok = result === 1 || result === 1n
          redisLog.debug(
            `[Redis] releaseLockKv(${key}) ${ok ? 'released' : 'failed (value mismatch)'}`,
          )
          return ok
        }
        throw innerErr
      }
    },
    false,
    `releaseLockKv(${key})`,
  )
}

/**
 * 检查并占用幂等 Key
 * @param key 幂等 Key
 * @param ttl 过期时间（秒）
 * @returns 是否成功占用 Key
 */
export async function acquireIdempotentKey(
  key: string,
  ttl: number,
): Promise<boolean> {
  // 开发模式 Redis 不生效：不做幂等去重，直接放行
  if (!isRedisEnabled) return true
  return safeRedisOp(
    async (client) => {
      const result = await client.send('SET', [
        key,
        'LOCKED',
        'EX',
        ttl.toString(),
        'NX',
      ])
      const success = result === 'OK'
      redisLog.debug(
        `[Redis] acquireIdempotentKey(${key}) ${success ? 'acquired' : 'already locked'}`,
      )
      return success
    },
    false,
    `acquireIdempotentKey(${key})`,
  )
}

/**
 * 执行完成后写入结果（可选）
 * @param key 幂等 Key
 * @param result 结果对象
 * @param ttl 过期时间（秒）
 */
export async function storeIdempotentResult<T>(
  key: string,
  result: T,
  ttl: number,
): Promise<void> {
  await safeRedisOp(
    (client) =>
      client.set(key, JSON.stringify(result), 'EX', ttl) as Promise<unknown>,
    undefined,
    `storeIdempotentResult(${key})`,
  )
}

/**
 * 获取幂等结果（可选）
 * @param key 幂等 Key
 */
export async function getIdempotentResult<T>(key: string): Promise<T | null> {
  return safeRedisOp(
    async (client) => {
      const res = await client.get(key)
      return res ? (JSON.parse(res) as T) : null
    },
    null,
    `getIdempotentResult(${key})`,
  )
}

/**
 * 生成幂等键的 SHA256 哈希
 * @param data 需要哈希的数据对象
 * @returns SHA256 哈希字符串
 */
export function generateIdempotentHash(data: any): string {
  const str = JSON.stringify(data)
  return createHash('sha256').update(str).digest('hex')
}
