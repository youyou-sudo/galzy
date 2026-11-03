#!/usr/bin/env bun
/**
 * 一次性回填脚本：把旧的「明细事件表」按周聚合进 galrc_stat_windows。
 *
 * ## 背景
 *
 * 统计从「每次事件写一行明细 + 读时聚合」改成「写时按 (kind, target_id, 周窗口) 自增」：
 * 新代码只写 galrc_stat_windows，旧表 galrc_event_views / galrc_gameDownloadStats 不再有
 * 写入方。历史累计值与历史周窗口必须从旧表搬过来，否则排行榜和「累计浏览/下载」会从 0 开始。
 *
 * 迁移顺序（建议）：
 *   1. bun --cwd apps/api db:up                     # 建 galrc_stat_windows
 *   2. bun --cwd apps/api scripts/backfill-stat-windows.ts --dry-run   # 先看会写多少
 *   3. bun --cwd apps/api scripts/backfill-stat-windows.ts             # 回填（幂等）
 *   4. 部署新代码（此后旧表不再写入）
 *   5. bun --cwd apps/api scripts/backfill-stat-windows.ts --merge     # 可选：把部署后
 *      新表已累计的增量与旧表合并（--merge 是「累加」，重跑会重复计数，只在明确需要时用）
 *   6. bun --cwd apps/api scripts/backfill-stat-windows.ts --truncate  # 回收旧表空间（569MB+79MB）
 *
 * ## 幂等性
 *
 * 默认语义是「以旧明细表为唯一事实来源」：`DO UPDATE SET total = EXCLUDED.total`，
 * 因此重跑结果完全一致。若在「新代码已开始写入新表」之后重跑，默认语义会把该窗口的
 * 计数重置回旧表的聚合值（丢掉部署后的增量）—— 这种场景请用 `--merge`。
 *
 * ## 窗口口径
 *
 * window_start 必须与读取侧 getEffectiveWeekStart() / getWeekKey()（libs/time-window.ts）
 * 完全一致：本地时区周一 00:00；**周一当天的事件仍记在上一周**（周一展示上一周榜单）。
 * 因此这里用 date_trunc('week', created_at) 再对周一减 7 天，而不是裸的 date_trunc。
 * 会话时区由 --tz / BACKFILL_TZ 决定（默认 UTC，与线上 API 容器一致）；时区不一致会让
 * 周窗口整体错位一周，务必确认。
 *
 * ## 用法
 *
 *   bun run scripts/backfill-stat-windows.ts [--dry-run] [--merge] [--truncate] [--tz=UTC]
 *
 *   --dry-run   只统计「会写入多少行」，不写库（可与 --merge 组合查看口径）
 *   --merge     DO UPDATE SET total = 现有 total + EXCLUDED.total（累加，非幂等）
 *   --truncate  回填成功后 TRUNCATE 两张旧明细表（回收 569MB + 79MB；不可恢复）
 *   --tz=Area/City  会话时区，默认 UTC
 */
import { SQL } from 'bun'

const argv = process.argv.slice(2)
const hasFlag = (name: string) => argv.includes(name)
const flagValue = (name: string): string | undefined =>
  argv.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1)

const dryRun = hasFlag('--dry-run')
const merge = hasFlag('--merge')
const truncate = hasFlag('--truncate')
const tz = flagValue('--tz') ?? process.env.BACKFILL_TZ ?? 'UTC'

if (!/^[A-Za-z0-9_+\-/]+$/.test(tz)) {
  console.error(`❌ 非法时区: ${tz}`)
  process.exit(1)
}
if (truncate && dryRun) {
  console.error('❌ --truncate 不能与 --dry-run 组合（dry-run 不写库，截断没有意义）')
  process.exit(1)
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error(
    '❌ DATABASE_URL 未设置。请在 apps/api 目录下运行（bun run 会自动加载 .env）。',
  )
  process.exit(1)
}

/** 周窗口表达式：与 getEffectiveWeekStart() 对齐（周一当天算上一周）。 */
const WINDOW_EXPR = `(date_trunc('week', created_at)
    - CASE WHEN EXTRACT(ISODOW FROM created_at) = 1 THEN interval '7 days' ELSE interval '0' END)::date`

const sql = new SQL(url, { max: 1, idleTimeout: 0 })

const formatBytes = (n: number) => {
  const units = ['B', 'kB', 'MB', 'GB']
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(1)}${units[i]}`
}

type TableSize = { relname: string; total: number }

const tableSizes = async (): Promise<TableSize[]> =>
  (await sql`
    SELECT c.relname AS relname, pg_total_relation_size(c.oid)::bigint::int AS total
    FROM pg_class c
    WHERE c.relname IN ('galrc_event_views', 'galrc_gameDownloadStats', 'galrc_stat_windows')
  `) as TableSize[]

/** 回填单张明细表；返回写入（插入 + 更新）的行数。 */
async function backfill(params: {
  label: string
  kindExpr: string
  table: string
  where: string
  conflict: string
}): Promise<number> {
  const { label, kindExpr, table, where, conflict } = params
  const source = `
    SELECT ${kindExpr} AS kind,
           ${table === 'galrc_event_views' ? 'target_id' : 'game_id'} AS target_id,
           ${WINDOW_EXPR} AS window_start,
           COUNT(*) AS total
    FROM "${table}"
    WHERE ${where}
    GROUP BY 1, 2, 3`

  if (dryRun) {
    const rows = (await sql.unsafe(
      `SELECT kind, count(*)::int AS windows, sum(total)::bigint::text AS events
       FROM (${source}) s GROUP BY kind ORDER BY kind`,
    )) as Array<{ kind: string; windows: number; events: string }>
    if (rows.length === 0) {
      console.log(`  ${label}: 无需回填（旧表无数据）`)
      return 0
    }
    for (const r of rows) {
      console.log(
        `  ${label} [${r.kind}]: 将写入 ${r.windows} 个窗口行，覆盖 ${r.events} 条历史事件`,
      )
    }
    return rows.reduce((acc, r) => acc + r.windows, 0)
  }

  const written = (await sql.unsafe(
    `INSERT INTO galrc_stat_windows (kind, target_id, window_start, total, updated_at)
     SELECT kind, target_id, window_start, total, now() FROM (${source}) s
     ON CONFLICT (kind, target_id, window_start)
     DO UPDATE SET total = ${conflict}, updated_at = now()
     RETURNING 1`,
  )) as unknown[]
  console.log(`  ${label}: 写入 ${written.length} 个窗口行`)
  return written.length
}

const startedAt = Date.now()
console.log(
  `⌛ 回填 galrc_stat_windows（时区 ${tz}，${dryRun ? 'dry-run' : merge ? 'merge（累加）' : 'replace（幂等覆盖）'}）`,
)

try {
  await sql.unsafe(`SET TimeZone = '${tz}'`)
  // 回填是一次性大聚合，不能被 30s statement_timeout 打断。
  await sql.unsafe("SET statement_timeout = '0'")

  const before = await tableSizes()

  // 旧表里 event_type 只允许 game_view / tag_view；其它值（历史遗留）跳过并提示。
  const otherTypes = (await sql`
    SELECT event_type, count(*)::int AS n
    FROM galrc_event_views
    WHERE event_type NOT IN ('game_view', 'tag_view')
    GROUP BY event_type
  `) as Array<{ event_type: string; n: number }>
  if (otherTypes.length > 0) {
    console.log(
      `  ⚠️  galrc_event_views 存在未识别的 event_type，已跳过: ${otherTypes
        .map((r) => `${r.event_type}(${r.n})`)
        .join(', ')}`,
    )
  }

  const conflict = merge
    ? 'galrc_stat_windows.total + EXCLUDED.total'
    : 'EXCLUDED.total'

  const gameViews = await backfill({
    label: 'galrc_event_views',
    kindExpr: 'event_type',
    table: 'galrc_event_views',
    where: "event_type IN ('game_view', 'tag_view')",
    conflict,
  })
  const downloads = await backfill({
    label: 'galrc_gameDownloadStats',
    kindExpr: "'game_download'",
    table: 'galrc_gameDownloadStats',
    where: 'TRUE',
    conflict,
  })

  const after = await tableSizes()
  const sizeOf = (list: TableSize[], name: string) =>
    list.find((r) => r.relname === name)?.total ?? 0
  console.log(
    `\n📊 galrc_stat_windows: ${formatBytes(sizeOf(before, 'galrc_stat_windows'))} → ${formatBytes(sizeOf(after, 'galrc_stat_windows'))}`,
  )

  if (!dryRun) {
    const summary = (await sql`
      SELECT kind, count(*)::int AS windows, sum(total)::bigint::text AS total
      FROM galrc_stat_windows GROUP BY kind ORDER BY kind
    `) as Array<{ kind: string; windows: number; total: string }>
    for (const r of summary) {
      console.log(`  ${r.kind}: ${r.windows} 个窗口行 / 合计 ${r.total}`)
    }
  }

  if (truncate) {
    console.log('\n🗑  TRUNCATE 旧明细表（不可恢复）…')
    await sql.unsafe(
      'TRUNCATE TABLE galrc_event_views, "galrc_gameDownloadStats"',
    )
    const final = await tableSizes()
    console.log(
      `  galrc_event_views: ${formatBytes(sizeOf(before, 'galrc_event_views'))} → ${formatBytes(sizeOf(final, 'galrc_event_views'))}`,
    )
    console.log(
      `  galrc_gameDownloadStats: ${formatBytes(sizeOf(before, 'galrc_gameDownloadStats'))} → ${formatBytes(sizeOf(final, 'galrc_gameDownloadStats'))}`,
    )
  } else {
    console.log(
      '\nℹ️  旧表未清理；确认回填结果后可用 --truncate 回收空间（569MB + 79MB）。',
    )
  }

  console.log(
    `\n✅ 完成（${gameViews + downloads} 个窗口行，耗时 ${((Date.now() - startedAt) / 1000).toFixed(1)}s）`,
  )
} catch (e) {
  console.error('❌ 回填失败:', e)
  process.exitCode = 1
} finally {
  await sql.close()
}
