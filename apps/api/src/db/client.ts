import { SQL } from 'bun'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import * as schema from './schema'

// 池上限：上游已证实 bun:sql 1.3.x 的池在并发获取竞态下会卡死（oven-sh/bun#30494，
// 同款 max:10 + idleTimeout:0 + unsafe() 配置在高并发下约 50% 概率触发；max 越低越安全，
// max:2 实测 100% 通过）。本项目流量不大（读多走 Redis 缓存），5 条连接足够，
// 同时显著降低卡死概率。可用 POSTGRES_POOL_MAX 覆盖。
const poolMax = Number(process.env.POSTGRES_POOL_MAX ?? 5)

// 单条语句超时。服务端默认值由迁移 0010（ALTER DATABASE）设置，这里在应用侧兜底，
// 覆盖迁移被跳过 / 失败的老库。可用 POSTGRES_STATEMENT_TIMEOUT 覆盖（如 '60s'、'30000ms'）。
const statementTimeoutRaw = process.env.POSTGRES_STATEMENT_TIMEOUT ?? '30s'
const STATEMENT_TIMEOUT_RE = /^\d+(ms|s|min)?$/
const statementTimeout = STATEMENT_TIMEOUT_RE.test(statementTimeoutRaw)
  ? statementTimeoutRaw
  : '30s'

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
//
// ⚠️ 只重试只读语句：写语句（INSERT/UPDATE/DELETE/MERGE）若在「服务端已提交、
// 但响应因连接断开而丢失」时重放，会造成重复写入（浏览量 / 下载次数翻倍等）。
const CONNECTION_ERROR_RE =
  /connection closed|idle timeout|econnreset|econnrefused|socket hang up|terminat|57P01|0800[036]/i

type RawQuery = Promise<unknown> & { values: () => Promise<unknown> }

const unsafeRaw = client.unsafe.bind(client) as (
  query: string,
  params: unknown[],
) => RawQuery

// 只读判定：允许 SELECT / SHOW / EXPLAIN / VALUES / TABLE，以及不含写关键字的
// WITH...SELECT。列名、字符串字面量里出现 write 关键字属于极端情况，宁可保守
// （判定为写语句 → 不重试）也不冒重复写入的风险。
const READ_ONLY_LEADING_RE =
  /^(?:\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)*(select|show|explain|values|table)\b/i
const WITH_LEADING_RE = /^(?:\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)*with\b/i
const WRITE_KEYWORD_RE = /\b(insert|update|delete|merge)\b/i

const isReadOnlyQuery = (query: string): boolean =>
  READ_ONLY_LEADING_RE.test(query) ||
  (WITH_LEADING_RE.test(query) && !WRITE_KEYWORD_RE.test(query))

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
  // 只读语句才允许重试（见上）。
  const readOnly = isReadOnlyQuery(query)
  // 惰性 thenable：drizzle 有两种消费方式（await / .values()）。结果 Promise 做
  // memo，保证同一次 client.unsafe() 调用只真正执行一次——此前 then/catch/finally/
  // values 各自独立发起，任何对 .finally()/.catch() 的直接调用都会让 SQL 跑第二遍。
  let objectsPromise: Promise<unknown> | undefined
  let valuesPromise: Promise<unknown> | undefined
  const runObjects = (): Promise<unknown> =>
    (objectsPromise ??= readOnly
      ? withConnectionRetry(() => unsafeRaw(query, params))
      : unsafeRaw(query, params))
  const runValues = (): Promise<unknown> =>
    (valuesPromise ??= readOnly
      ? withConnectionRetry(() => unsafeRaw(query, params).values())
      : unsafeRaw(query, params).values())
  return {
    // biome-ignore lint/suspicious/noThenProperty: drizzle 会直接 await client.unsafe(...)，必须暴露 then
    then: (res: never, rej: never) => runObjects().then(res, rej),
    catch: (rej: never) => runObjects().catch(rej),
    finally: (fn: () => void) => runObjects().finally(fn),
    values: () => runValues(),
  }
}) as typeof client.unsafe

export const db = drizzle({ client, schema })

/**
 * 给连接池里已经建立的每条连接设置 statement_timeout。
 *
 * 背景：`SET statement_timeout` 是会话级的，而 bun:sql 的连接池没有 per-connection
 * 初始化钩子（`onconnect` 只回传 err，拿不到连接对象），所以顶层跑一次 SET 只会落到
 * 池里随机一条连接上，其余连接没有超时保护。迁移 0010 的 `ALTER DATABASE ... SET`
 * 只对「此后新建的会话」生效，覆盖不到进程启动时就已存在的连接。
 *
 * 做法：并发开 poolMax 个事务。每个事务在提交前独占一条连接，池为保证并发必须
 * 提供 poolMax 条不同连接，于是 `SET` 覆盖到池里的全部连接；提交后连接带着会话级
 * 设置回到池中（`SET` 在事务提交后仍然生效，`SET LOCAL` 才会回滚）。
 *
 * 在迁移完成之后调用，避免 30s 超时误杀长 DDL。
 */
export async function primeConnectionSettings(): Promise<void> {
  const connections =
    Number.isFinite(poolMax) && poolMax > 0 ? Math.floor(poolMax) : 5
  await Promise.all(
    Array.from({ length: connections }, () =>
      db.transaction(async (tx) => {
        await tx.execute(
          sql.raw(`SET statement_timeout = '${statementTimeout}'`),
        )
      }),
    ),
  )
}

export { sql }
