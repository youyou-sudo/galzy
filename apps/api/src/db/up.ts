import { sql } from 'drizzle-orm'
import { db } from './client'
import { applyPendingMigrations } from './migrate'

/**
 * `db:up` CLI——应用挂起的数据库迁移。
 *
 * 与生产启动路径（dbAction → applyPendingMigrations）共用同一实现与
 * drizzle.__drizzle_migrations 日志表（幂等，按 created_at 跳过已应用项）。
 *
 * 注意：drizzle-kit 0.31 的 `up` 命令只做快照格式升级、不应用迁移，
 * 因此这里直接调用 bun-sql migrator，而不是 drizzle-kit。
 *
 * 退出码：0 = 迁移已应用或已是最新；1 = 连接失败 / 目录缺失 / 拒绝应用 / 迁移失败。
 */
const [dbOk, dbError] = await db.execute(sql`SELECT 1`).then(
  () => [true, null] as const,
  (e: unknown) => [false, e] as const,
)

if (!dbOk) {
  console.error('❌ Database connection test failed:', dbError)
  process.exit(1)
}
console.log('✅ Database connection test successful')

console.log('⌛ Applying pending migrations...')
const result = await applyPendingMigrations()

// skipped（目录缺失 / unsafe 拒绝应用）与 failed 的消息均已由 applyPendingMigrations 输出
if (result.status !== 'applied') {
  process.exit(1)
}
process.exit(0)
