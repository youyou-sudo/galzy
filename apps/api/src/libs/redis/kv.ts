import { redis } from './index'
import { createHash } from 'node:crypto'

export const setKv = async (key: string, value: string, time?: number) => {
  if (!redis) return
  return time ? redis.setex(key, time, value) : redis.set(key, value)
}

export const getKv = async (key: string) => {
  if (!redis) return null
  return redis.get(key)
}

export const delKv = async (key: string) => {
  if (!redis) return
  return redis.del(key)
}

export const delKvPattern = async (pattern: string) => {
  if (!redis) return
  const keys = await redis.keys(pattern)
  if (keys.length > 0) {
    return redis.del(...keys)
  }
  return 0
}

export const deacquireLocklKv = async (
  lockKey: string,
  lockValue: string,
  lockTimeout: number,
) => {
  const lock = await redis.set(lockKey, lockValue, 'PX', lockTimeout, 'NX')
  return lock === 'OK'
}

export const releaseLockKv = async (lockKey: string, lockValue: string) => {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `
  const result = await redis.eval(script, 1, lockKey, lockValue)
  return result === 1
}

/**
 * 检查并占用幂等 Key
 * @param key 唯一标识，比如 "order:123" 或 "req:<uuid>"
 * @param ttl 过期时间（秒）
 * @returns 是否首次执行（true 表示成功占位，可以执行逻辑）
 */
export async function acquireIdempotentKey(
  key: string,
  ttl: number,
): Promise<boolean> {
  if (!redis) throw new Error('Redis client not initialized')

  // 仅当 key 不存在时设置成功
  const setRes = await redis.set(key, 'LOCKED', 'EX', ttl, 'NX')
  return setRes === 'OK'
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
  if (!redis) return
  await redis.set(key, JSON.stringify(result), 'EX', ttl)
}

/**
 * 获取幂等结果（可选）
 * @param key 幂等 Key
 */
export async function getIdempotentResult<T>(key: string): Promise<T | null> {
  if (!redis) return null
  const res = await redis.get(key)
  return res ? (JSON.parse(res) as T) : null
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
