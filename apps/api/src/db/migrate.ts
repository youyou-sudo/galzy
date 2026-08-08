import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { setDeployStatus } from '@api/modules/status/service'
import { redis } from 'bun'
import { migrate } from 'drizzle-orm/bun-sql/migrator'
import { db, sql } from './client'

/**
 * 定位迁移文件目录（drizzle/*.sql + meta/_journal.json）。
 * - 开发：cwd = apps/api（bun run dev / bun --cwd apps/api dev）→ apps/api/drizzle
 * - 编译产物：Docker WORKDIR /app，drizzle 目录由 Dockerfile COPY 到 /app/drizzle
 * - 兜底：从源码位置（src/db/migrate.ts）向上两级的 apps/api/drizzle
 */
function resolveMigrationsFolder(): string | null {
  const candidates = [
    join(process.cwd(), 'drizzle'),
    join(import.meta.dir, '../../drizzle'),
  ]
  return candidates.find(existsSync) ?? null
}

/**
 * 启动时数据库准备：连通性检查 → 应用挂起迁移 → Redis 探活。
 *
 * 历史问题：此前这里只做 `SELECT 1`，从不执行迁移；全新数据库部署时没有任何表，
 * 而生产环境 cron 在启动后立即运行（如 workerDataPull 查询 galrc_cloudflare），
 * 于是每分钟报 `relation "galrc_cloudflare" does not exist`。
 * 现在启动即应用挂起的迁移——与 db:up（drizzle-kit up）同一套迁移文件与日志表
 * （drizzle.__drizzle_migrations，按 created_at 跳过已应用项，幂等）。
 *
 * @returns DB 是否就绪（迁移成功或无需迁移）；cron 等依赖表的任务应据此再启动
 */
export const dbAction = async (): Promise<boolean> => {
  console.log('⌛ Running database migration check...')

  const [dbOk, dbError] = await db.execute(sql`SELECT 1`).then(
    () => [true, null] as const,
    (e: unknown) => [false, e] as const,
  )

  if (!dbOk) {
    setDeployStatus('error')
    console.error('❌ Database connection test failed:', dbError)
    return false
  }

  console.log('✅ Database connection test successful')
  setDeployStatus('migrating')

  const migrationsFolder = resolveMigrationsFolder()
  if (!migrationsFolder) {
    setDeployStatus('error')
    console.error(
      '❌ Migrations folder not found (looked for "drizzle" next to cwd and src). ' +
        'Docker 镜像需包含 apps/api/drizzle（见 apps/api/Dockerfile 的 COPY --from=build /app/apps/api/drizzle /app/drizzle）。',
    )
    return false
  }

  // 迁移日志状态决定是否安全地自动迁移：
  // - 有日志行 → migrate() 只应用挂起的迁移（幂等，升级场景安全）；
  // - 无日志且无任何业务表 → 全新数据库，应用全部迁移；
  // - 无日志但已有业务表 → 无法判断哪些迁移已应用（0011 是破坏性数据迁移，
  //   绝不能重跑），跳过自动迁移，保持现库原样，仅告警 + 给出一次性对账 SQL。
  const journalState = await db
    .execute(sql`
      SELECT
        to_regclass('drizzle.__drizzle_migrations') AS journal_table,
        (SELECT count(*)::int FROM information_schema.tables WHERE table_schema = 'public') AS public_tables
    `)
    .then(
      (rows) => ({
        journalExists:
          (rows[0] as { journal_table: string | null }).journal_table !== null,
        publicTables: Number(
          (rows[0] as { public_tables: number }).public_tables ?? 0,
        ),
      }),
      (e: unknown) => {
        console.warn(
          '⚠️ 迁移日志检查失败，按保守策略跳过自动迁移:',
          e instanceof Error ? e.message : String(e),
        )
        return { journalExists: false, publicTables: -1 }
      },
    )

  let journalCount = 0
  if (journalState.journalExists) {
    const rows = await db.execute(
      sql`SELECT count(*)::int AS c FROM drizzle.__drizzle_migrations`,
    )
    journalCount = Number((rows[0] as { c: number }).c ?? 0)
  }

  const canAutoMigrate = journalCount > 0 || journalState.publicTables === 0

  if (!canAutoMigrate) {
    console.warn(
      `⚠️ 检测到已有 ${journalState.publicTables} 张业务表，但迁移日志表 drizzle.__drizzle_migrations 不存在或为空。\n` +
        '   已跳过自动迁移：无法判断哪些迁移已应用，重跑破坏性迁移（0011 合并话题帖）可能损坏数据。\n',
    )
    setDeployStatus('ready')
  } else {
    try {
      await migrate(db, { migrationsFolder })
      console.log('✅ Database migrations applied')
    } catch (e) {
      setDeployStatus('error')
      console.error(
        '❌ Database migrations failed:',
        e instanceof Error ? e.message : String(e),
      )
      return false
    }
    setDeployStatus('ready')
  }

  try {
    const pong = await redis.ping()
    if (pong === 'PONG') {
      console.log('✅ Redis connection test successful')
    } else {
      console.warn(
        '⚠️  Redis ping returned unexpected response — continuing without cache/locks',
      )
    }
  } catch (e) {
    console.warn(
      '⚠️  Redis unavailable — continuing without cache/locks:',
      e instanceof Error ? e.message : String(e),
    )
  }

  console.log('🎉 Database loading complete')
  return true
}
