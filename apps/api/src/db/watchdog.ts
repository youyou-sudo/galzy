import { SQL } from 'bun'
import { sql } from 'drizzle-orm'
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql'
import { db } from './client'

export interface DbWatchdogOptions {
  /** 探测周期（毫秒），默认 15s */
  intervalMs?: number
  /** 单次探测超时（毫秒），默认 5s */
  probeTimeoutMs?: number
  /** 连续判定「池卡死」多少次后退出进程，默认 3（约 45s 内完成自愈） */
  exitThreshold?: number
  /** 被测连接池（默认：应用共享的 db） */
  db?: BunSQLDatabase
  /** 独立健康探针连接（默认：新建单连接客户端） */
  admin?: SQL
}

/**
 * bun:sql 连接池卡死看门狗。
 *
 * 背景：oven-sh/bun#30494（bun 1.3.13/1.3.14 已复现、上游未修复）——池在连接被切断后
 * 的并发获取竞态下会永久停止派发：PG 侧连接健康、但 Bun 侧所有查询挂起/报
 * "Failed to read data"，只能重启进程恢复。本项目生产环境 2026-08-02 事故即为该模式。
 *
 * 原理：用一条独立连接（max:1、顺序探测、无并发，不触发该竞态）做 DB 健康基准，
 * 与被测池对比：
 * - 池失败/超时 且 独立连接正常 → 判定池卡死；连续 exitThreshold 次后 process.exit(1)，
 *   由编排层（Docker/k8s 重启策略）拉起新进程，把「不可用数小时」降为「几十秒」。
 * - 池与独立连接都失败 → DB 本身不可用（维护/网络中断），不退出，避免重启风暴。
 *
 * 仅在 NODE_ENV=production 启动（index.ts），开发环境不应自杀式退出。
 */
export function startDbWatchdog(options: DbWatchdogOptions = {}) {
  const {
    intervalMs = 15_000,
    probeTimeoutMs = 5_000,
    exitThreshold = 3,
    db: targetDb = db,
    admin: adminClient = new SQL({
      url: process.env.DATABASE_URL!,
      max: 1,
      idleTimeout: 0,
      connectionTimeout: 10_000,
    }),
  } = options

  let wedgeCount = 0
  let probing = false

  // 竞速：查询成功 → true；失败或超时 → false。查询的 rejection 已被吞掉，不会产生
  // unhandled rejection。
  function withTimeout(
    promise: Promise<unknown>,
    ms: number,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), ms)
      promise.then(
        () => {
          clearTimeout(timer)
          resolve(true)
        },
        (error: unknown) => {
          clearTimeout(timer)
          resolve(false)
          void error
        },
      )
    })
  }

  async function probePool(): Promise<boolean> {
    return withTimeout(targetDb.execute(sql.raw('SELECT 1')), probeTimeoutMs)
  }

  async function probeAdmin(): Promise<boolean> {
    return withTimeout(adminClient.unsafe('SELECT 1'), probeTimeoutMs)
  }

  async function tick() {
    if (probing) return // 上一轮未结束（池卡死时查询会一直挂着），跳过本轮
    probing = true
    try {
      const [poolOk, adminOk] = await Promise.all([probePool(), probeAdmin()])

      if (poolOk) {
        if (wedgeCount > 0) {
          console.log('[db-watchdog] 连接池已恢复')
        }
        wedgeCount = 0
        return
      }

      if (adminOk) {
        // 独立连接正常而池失败 → 池卡死（上游 #30494 模式）
        wedgeCount++
        console.error(
          `[db-watchdog] 连接池疑似卡死（${wedgeCount}/${exitThreshold}）：DB 健康但池查询失败/超时`,
        )
        if (wedgeCount >= exitThreshold) {
          console.error('[db-watchdog] 连续判定池卡死，退出进程以触发自动重启')
          process.exit(1)
        }
      } else {
        wedgeCount = 0
        console.warn(
          '[db-watchdog] DB 本身不可用（池与独立探针均失败），等待恢复，不退出',
        )
      }
    } finally {
      probing = false
    }
  }

  const timer = setInterval(tick, intervalMs)
  timer.unref?.()
  void tick()
  return timer
}
