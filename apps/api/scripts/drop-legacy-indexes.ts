#!/usr/bin/env bun
/**
 * 一次性维护脚本：删除早期外部建库脚本留下的重复索引。
 *
 * ## 为什么不放进迁移（drizzle/0023）
 *
 * 这批索引（`galrc_alistb_vid_index` / `tags_id_index` / `producers_index` …）
 * 由早期的外部建库脚本创建，本仓库的迁移链（0000–0022）**从未创建过它们**
 * —— `rg 'CREATE INDEX' drizzle/` 只会看到 `idx_*` 命名，全新数据库不会有这些索引。
 * 而 drizzle 迁移器把整个迁移文件的语句放在**一个事务**里执行，约 20 条
 * `DROP INDEX` 会同时持有 10 多张表的 ACCESS EXCLUSIVE 锁；线上流量按
 * 「先 tags 再 tags_vn」的顺序加 AccessShareLock，与迁移相反，实测直接触发
 * deadlock（Process waits for AccessExclusiveLock on tags_vn, blocked by ...）。
 *
 * ## 为什么用 DROP INDEX CONCURRENTLY
 *
 * CONCURRENTLY 不阻塞读写（不需要 ACCESS EXCLUSIVE），代价是必须逐条在
 * 自动提交下执行、不能包在事务里 —— 正好符合「脚本逐条跑」的形态。
 *
 * ## 安全性
 *
 * - 幂等：索引不存在则跳过。
 * - 保护：先查 pg_constraint，凡是被主键/唯一约束占用的索引一律不删。
 * - 逐个报告 + 结束时打印剩余索引占用，失败不影响其他索引。
 *
 * 用法（在 apps/api 下）：
 *   bun run db:drop-legacy-indexes
 */
import { SQL } from 'bun'

/**
 * 待清理的索引名 → 保留下来的等价索引（注释用）。
 * 每一项都被括号里的索引完全覆盖（同一 btree key，或由主键/唯一约束承担），
 * 且线上累计 idx_scan 为 0~几十次（对照保留项为百万到千万级）。
 */
const LEGACY_INDEXES: Array<{ name: string; coveredBy: string }> = [
  { name: 'galrc_alistb_vid_index', coveredBy: 'idx_galrc_alistb_vid' },
  { name: 'galrc_alistb_other_index', coveredBy: 'idx_galrc_alistb_other' },
  { name: 'galrc_article_vid', coveredBy: 'idx_galrc_article_vid' },
  { name: 'galrc_article_otherid', coveredBy: 'idx_galrc_article_otherid' },
  { name: 'galrc_article_status', coveredBy: 'idx_galrc_article_status' },
  { name: 'galrc_article_type', coveredBy: 'idx_galrc_article_type' },
  { name: 'galrc_accounts_userId_index', coveredBy: 'idx_galrc_account_user_id' },
  // 标签/作者/标题这几组是「同一列同时存在 idx_* 与 <表>_*_index 两个索引」
  { name: 'tags_id_index', coveredBy: 'tags_pkey' },
  { name: 'producers_index', coveredBy: 'producers_pkey' },
  { name: 'vn_titles_index', coveredBy: 'idx_vn_titles_id' },
  { name: 'releases_titles_index', coveredBy: 'idx_releases_titles_id' },
  { name: 'releases_producers_index', coveredBy: 'idx_releases_producers_id' },
  { name: 'releases_producers_pid_index', coveredBy: 'idx_releases_producers_pid' },
  { name: 'galrc_other_status_index', coveredBy: 'idx_galrc_other_status' },
  { name: 'galrc_media_hash_index', coveredBy: 'galrc_media_pkey (hash)' },
  { name: 'galrc_siteConfig_key_index', coveredBy: 'galrc_siteConfig_pkey (key)' },
  { name: 'galrc_user_email_index', coveredBy: 'galrc_user_email_key' },
  { name: 'tags_vn_tag_index', coveredBy: 'idx_tags_vn_tag' },
  { name: 'tags_vn_vid_index', coveredBy: 'idx_tags_vn_vid' },
  {
    name: 'galrc_gameDownloadStats_game_id_index',
    coveredBy: 'idx_galrc_game_download_stats_game_id',
  },
  {
    // file_path 只有写入（download/service.ts 的 insert），仓库内没有按它过滤的查询
    name: 'galrc_gameDownloadStats_file_path_index',
    coveredBy: '（无查询使用）',
  },
]

type IndexProbe = { oid: number; constraint_name: string | null } | undefined

const url = process.env.DATABASE_URL
if (!url) {
  console.error(
    '❌ DATABASE_URL 未设置。请在 apps/api 目录下运行（bun run 会自动加载 .env），' +
      '或显式传 --env-file .env。',
  )
  process.exit(1)
}

const sql = new SQL(url, { max: 1, idleTimeout: 0 })
let dropped = 0
let skipped = 0
let failed = 0

try {
  for (const { name, coveredBy } of LEGACY_INDEXES) {
    const probe = (
      await sql`
        SELECT c.oid::int AS oid, con.conname AS constraint_name
        FROM pg_class c
        LEFT JOIN pg_constraint con ON con.conindid = c.oid
        WHERE c.relname = ${name} AND c.relkind = 'i'
      `
    )[0] as IndexProbe

    if (!probe) {
      console.log(`  skip  ${name}（不存在）`)
      skipped++
      continue
    }
    if (probe.constraint_name) {
      console.log(
        `  skip  ${name}（被约束 ${probe.constraint_name} 占用，必须保留）`,
      )
      skipped++
      continue
    }

    try {
      // CONCURRENTLY 不能在事务里执行；bun 的单条语句是自动提交的，符合要求。
      await sql.unsafe(`DROP INDEX CONCURRENTLY IF EXISTS "${name}"`)
      console.log(`  drop  ${name}  ← 由 ${coveredBy} 覆盖`)
      dropped++
    } catch (e) {
      // 并发删索引中途失败会留下 invalid 索引，此时只能用非并发 DROP 收尾
      // （短暂的 ACCESS EXCLUSIVE，仅发生在异常路径）。
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`  retry ${name}（CONCURRENTLY 失败：${msg}）`)
      try {
        await sql.unsafe(`DROP INDEX IF EXISTS "${name}"`)
        console.log(`  drop  ${name}（非并发回退成功）`)
        dropped++
      } catch (e2) {
        console.error(
          `  FAIL  ${name}: ${e2 instanceof Error ? e2.message : String(e2)}`,
        )
        failed++
      }
    }
  }

  const [totals] = (await sql`
    SELECT count(*)::int AS idx_count,
           pg_size_pretty(sum(pg_relation_size(indexrelid))) AS idx_size
    FROM pg_stat_user_indexes
  `) as Array<{ idx_count: number; idx_size: string }>
  console.log(
    `\n完成：dropped=${dropped} skipped=${skipped} failed=${failed}` +
      `；当前 public 下索引 ${totals?.idx_count} 个 / ${totals?.idx_size}`,
  )
  process.exit(failed > 0 ? 1 : 0)
} finally {
  await sql.close()
}
