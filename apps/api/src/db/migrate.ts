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

export type MigrationApplyResult =
  | { status: 'applied'; appliedCount: number }
  | { status: 'skipped'; reason: 'no-folder' }
  | { status: 'skipped'; reason: 'unsafe'; publicTables: number }
  | { status: 'failed'; error: string }

// bun-sql execute 返回数组型对象（无索引签名）；行形状由下方 SQL 固定。
type JournalProbeRow = { journal_table: string | null; public_tables: number }
type CountRow = { c: number }

/**
 * 应用挂起的数据库迁移——启动自动迁移与 `db:up` CLI 共用的唯一实现。
 *
 * 安全护栏（决定是否应用）：
 * - 有日志行 → migrate() 只应用挂起的迁移（幂等，升级场景安全）；
 * - 无日志且无任何业务表 → 全新数据库，应用全部迁移；
 * - 无日志但已有业务表 → 无法判断哪些迁移已应用（0011 是破坏性数据迁移，
 *   绝不能重跑），跳过并告警，保持现库原样。
 *
 * 注意：drizzle-kit 0.31 的 `up` 命令只做快照格式升级（updateUpToV6/V7），
 * 不连接数据库、不应用迁移；此处用的是与生产启动路径相同的
 * drizzle-orm bun-sql migrator（drizzle.__drizzle_migrations 日志表，幂等）。
 */
export async function applyPendingMigrations(): Promise<MigrationApplyResult> {
  const migrationsFolder = resolveMigrationsFolder()
  if (!migrationsFolder) {
    console.error(
      '❌ Migrations folder not found (looked for "drizzle" next to cwd and src). ' +
        'Docker 镜像需包含 apps/api/drizzle（见 apps/api/Dockerfile 的 COPY --from=build /app/apps/api/drizzle /app/drizzle）。',
    )
    return { status: 'skipped', reason: 'no-folder' }
  }

  const journalState = await db
    .execute(sql`
      SELECT
        to_regclass('drizzle.__drizzle_migrations') AS journal_table,
        (SELECT count(*)::int FROM information_schema.tables WHERE table_schema = 'public') AS public_tables
    `)
    .then(
      (rows) => {
        const row = rows[0] as JournalProbeRow | undefined
        return {
          journalExists: row?.journal_table != null,
          publicTables: Number(row?.public_tables ?? 0),
        }
      },
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
    const row = rows[0] as CountRow | undefined
    journalCount = Number(row?.c ?? 0)
  }

  const canAutoMigrate = journalCount > 0 || journalState.publicTables === 0

  if (!canAutoMigrate) {
    console.warn(
      `⚠️ 检测到已有 ${journalState.publicTables} 张业务表，但迁移日志表 drizzle.__drizzle_migrations 不存在或为空。\n` +
        '   已跳过自动迁移：无法判断哪些迁移已应用，重跑破坏性迁移（0011 合并话题帖）可能损坏数据。\n',
    )
    return {
      status: 'skipped',
      reason: 'unsafe',
      publicTables: journalState.publicTables,
    }
  }

  try {
    await migrate(db, { migrationsFolder })
    const rows = await db.execute(
      sql`SELECT count(*)::int AS c FROM drizzle.__drizzle_migrations`,
    )
    const row = rows[0] as CountRow | undefined
    const appliedCount = Number(row?.c ?? 0) - journalCount
    if (appliedCount > 0) {
      console.log(`✅ Applied ${appliedCount} migration(s)`)
    } else {
      console.log('✅ Database migrations up to date')
    }
    return { status: 'applied', appliedCount }
  } catch (e) {
    console.error(
      '❌ Database migrations failed:',
      e instanceof Error ? e.message : String(e),
    )
    return {
      status: 'failed',
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

/**
 * 启动时数据库准备：连通性检查 → 应用挂起迁移 → Redis 探活。
 *
 * 历史问题：此前这里只做 `SELECT 1`，从不执行迁移；全新数据库部署时没有任何表，
 * 而生产环境 cron 在启动后立即运行（如 workerDataPull 查询 galrc_cloudflare），
 * 于是每分钟报 `relation "galrc_cloudflare" does not exist`。
 * 现在启动即应用挂起的迁移——与 `db:up`（src/db/up.ts）共用
 * applyPendingMigrations() 同一套迁移文件与日志表，幂等。
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

  const result = await applyPendingMigrations()

  // failed / no-folder：环境错误，终止启动；unsafe：跳过告警后保持原库继续启动。
  // 具体日志均由 applyPendingMigrations 输出。
  if (result.status === 'failed') {
    setDeployStatus('error')
    return false
  }
  if (result.status === 'skipped' && result.reason === 'no-folder') {
    setDeployStatus('error')
    return false
  }
  setDeployStatus('ready')

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
