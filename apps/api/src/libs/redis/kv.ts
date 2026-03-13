import { createHash } from 'node:crypto'
import { redis } from "bun";

/**
 * 设置 Key-Value 对，并可选设置过期时间
 * @param key 键
 * @param value 值
 * @param time 过期时间（秒），如果不传则永久有效
 * @returns Redis 操作结果
 */
export const setKv = async (key: string, value: string, time?: number) => {
  if (!redis) return
  return time ? redis.setex(key, time, value) : redis.set(key, value)
}

/**
 * 获取 Key 对应的值
 * @param key 键
 * @returns 对应的值，如果 Key 不存在则返回 null
 */
export const getKv = async (key: string) => {
  if (!redis) return null
  return redis.get(key)
}


/**
 * 删除 Key
 * @param key 键
 * @returns 被删除的 Key 数量
 */
export const delKv = async (key: string) => {
  if (!redis) return
  return redis.del(key)
}


/**
 * 根据模式删除 Key
 * @param pattern 模式，例如 "session:*" 将删除所有以 "session:" 开头的 Key
 * @returns 被删除的 Key 数量
 */
export const delKvPattern = async (pattern: string) => {
  if (!redis) return
  const keys = await redis.keys(pattern)
  if (keys.length > 0) {
    return redis.del(...keys)
  }
  return 0
}

/**
 * 尝试获取分布式锁
 * @param lockKey 锁的 Key
 * @param lockValue 锁的值（通常是唯一标识）
 * @param lockTimeout 锁的过期时间（毫秒）
 * @returns 是否成功获取锁
 */
export const acquireLockKv = async (
  lockKey: string,
  lockValue: string,
  lockTimeout: number
) => {
  const result = await redis.send("SET", [
    lockKey,
    lockValue,
    "PX",
    lockTimeout.toString(),
    "NX",
  ]);

  return result === "OK";
}

/**
 * 释放分布式锁
 * @param lockKey 锁的 Key
 * @param lockValue 锁的值（必须与获取锁时使用的值相同）
 * @returns 是否成功释放锁
 */
export const releaseLockKv = async (key: string, value: string) => {
  const script = `
if redis.call("get", KEYS[1]) == ARGV[1]
then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

  return redis.send("EVAL", [script, "1", key, value]);
};

/**
 * 检查并占用幂等 Key
 * @param key 幂等 Key
 * @param ttl 过期时间（秒）
 * @returns 是否成功占用 Key
 */
export async function acquireIdempotentKey(
  key: string,
  ttl: number
): Promise<boolean> {
  if (!redis) throw new Error("Redis client not initialized");

  const result = await redis.send("SET", [
    key,
    "LOCKED",
    "EX",
    ttl.toString(),
    "NX",
  ]);

  return result === "OK";
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
