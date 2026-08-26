import { SQL } from 'bun'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import * as schema from './schema'

// 池上限：上游已证实 bun:sql 1.3.x 的池在并发获取竞态下会卡死（oven-sh/bun#30494，
// 同款 max:10 + idleTimeout:0 + unsafe() 配置在高并发下约 50% 概率触发；max 越低越安全，
// max:2 实测 100% 通过）。本项目流量不大（读多走 Redis 缓存），5 条连接足够，
// 同时显著降低卡死概率。可用 POSTGRES_POOL_MAX 覆盖。
const poolMax = Number(process.env.POSTGRES_POOL_MAX ?? 5)

const client = new SQL({
  url: process.env.DATABASE_URL!,
  max: poolMax,
  // 禁用连接空闲回收（0 = 不注册空闲定时器）：bun:sql 会把空闲超时的连接标记为
  // failed，但并发查询仍可能被派发到这些连接上，报 "Idle timeout reached after 5m"，
  // 导致长时间无流量后的首批请求 500。死连接会在下次使用时自动重建。
  // better-auth 也走此连接池（modules/auth/service.ts 的 drizzleAdapter）。
  idleTimeout: 0,
})

// 远程库/中间层会掐断长时间空闲的 TCP 连接（服务端 idle timeout），
// 而客户端 idleTimeout: 0 不主动回收 → 池里的死连接被派发后报
// "Connection closed"，首页/详情页随机 500。死连接在下一次使用时会自动重建，
// 因此对连接类错误原地重试一次即可恢复；非连接类错误照常抛出。
const CONNECTION_ERROR_RE =
  /connection closed|idle timeout|econnreset|econnrefused|socket hang up|terminat|57P01|0800[036]/i

const unsafeRaw = client.unsafe.bind(client) as (
  query: string,
  params: unknown[],
) => Promise<unknown> & { values: () => Promise<unknown> }

const withConnectionRetry = async <T>(exec: () => Promise<T>): Promise<T> => {
  try {
    return await exec()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (CONNECTION_ERROR_RE.test(message)) return await exec()
    throw err
  }
}

client.unsafe = ((query: string, params: unknown[]) => {
  // 惰性 thenable：drizzle 两种消费方式（await / .values()）各自触发一次执行，
  // 命中连接类错误时用池内重建的新连接重试一次。
  const q = {
    // biome-ignore lint/suspicious/noThenProperty: drizzle 会直接 await client.unsafe(...)，必须暴露 then
    then: (res: never, rej: never) =>
      withConnectionRetry(() => unsafeRaw(query, params)).then(res, rej),
    catch: (rej: never) =>
      withConnectionRetry(() => unsafeRaw(query, params)).catch(rej),
    finally: (fn: () => void) =>
      withConnectionRetry(() => unsafeRaw(query, params)).finally(fn),
    values: () => withConnectionRetry(() => unsafeRaw(query, params).values()),
  }
  return q
}) as typeof client.unsafe

export const db = drizzle({ client, schema })

// Set per-session timeout to prevent runaway queries from holding connections.
// Also set at database level via migration 0010 for all connections.
await db.execute(sql.raw(`SET statement_timeout = '30s'`))

export { sql }
