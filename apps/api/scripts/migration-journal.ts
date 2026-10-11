#!/usr/bin/env bun
/**
 * 迁移日志对账工具：把 drizzle.__drizzle_migrations 与仓库里的迁移文件对齐。
 *
 * ## 背景
 *
 * `drizzle-orm/bun-sql/migrator` 判定是否应用某条迁移的依据是
 * 「日志表里最大的 created_at」vs「迁移文件的 when」，
 * 而日志表里的 `hash`（迁移文件字节的 sha256）**只写不校验** ——
 * 迁移器自己从不比对它。于是两种问题都会静默发生：
 *
 * 1. 迁移文件在应用之后被手工编辑 → 日志里的 hash 与文件不再对应，
 *    「这条迁移到底应用的是哪版内容」变得无法回答。
 * 2. 日志表里出现重复行 / 遗留行 → 无从判断哪些迁移真的应用过。
 *
 * 本项目 2026-10-11 的状态：`0000`–`0008`、`0011`、`0020` 共 11 条记录的 hash
 * 与当前文件不一致；另有 15 行重复/遗留记录。已应用内容无法找回，
 * 因此采用「重新基线化」：把日志修正为当前文件，之后任何新漂移都可被测出。
 * 详见 docs/migration-journal.md。
 *
 * ## 用法
 *
 *   bun run db:verify-migrations              # 只读校验，有问题退出码 1
 *   bun run db:verify-migrations -- --apply   # 对账并写入（默认只打印计划）
 *
 * 建议：改完迁移文件后、发版前跑一次只读校验。
 */
import { SQL } from 'bun'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS_FOLDER = 'drizzle'
const JOURNAL_TABLE = 'drizzle.__drizzle_migrations'

type JournalEntry = { idx: number; when: number; tag: string }
type DbRow = { id: number; hash: string; created_at: string }

/**
 * 判定完全基于 hash：日志里存在 hash == 文件内容 sha256 的行，才算
 * 「这条迁移的当前内容已被记录为应用过」。不依赖 created_at 配对 ——
 * `when` 被修正过（见 docs/migration-journal.md）之后，历史 created_at
 * 与新 `when` 不再相等，用 created_at 配对会产生误导性的结论。
 */
type Status =
  | {
      kind: 'applied'
      entry: JournalEntry
      fileHash: string
      row: DbRow
      whenDrift: boolean
    }
  | { kind: 'not-recorded'; entry: JournalEntry; fileHash: string }

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

const journalPath = join(MIGRATIONS_FOLDER, 'meta/_journal.json')
const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
  entries: JournalEntry[]
}

const entries = journal.entries.map((e) => ({
  ...e,
  fileHash: sha256(readFileSync(join(MIGRATIONS_FOLDER, `${e.tag}.sql`), 'utf8')),
}))

// ── 顺序不变量：when 必须严格递增 ───────────────────────────────
const orderProblems: string[] = []
for (let i = 1; i < entries.length; i++) {
  if (entries[i].when <= entries[i - 1].when) {
    orderProblems.push(
      `${entries[i].tag} (when=${entries[i].when}) 不大于上一条 ${entries[i - 1].tag} (when=${entries[i - 1].when})`,
    )
  }
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error(
    '❌ DATABASE_URL 未设置。请在 apps/api 目录下运行（bun run 会自动加载 .env）。',
  )
  process.exit(1)
}
const sql = new SQL(url, { max: 1, idleTimeout: 0 })
const rows = (await sql`
  SELECT id, hash, created_at::bigint::text AS created_at
  FROM drizzle.__drizzle_migrations
  ORDER BY created_at, id
`) as DbRow[]

const rowsByHash = new Map<string, DbRow[]>()
for (const r of rows) {
  if (!rowsByHash.has(r.hash)) rowsByHash.set(r.hash, [])
  rowsByHash.get(r.hash)!.push(r)
}

const statuses: Status[] = entries.map((entry) => {
  const row = rowsByHash.get(entry.fileHash)?.[0]
  if (!row) return { kind: 'not-recorded', entry, fileHash: entry.fileHash }
  return {
    kind: 'applied',
    entry,
    fileHash: entry.fileHash,
    row,
    whenDrift: row.created_at !== String(entry.when),
  }
})

const claimed = new Set(
  statuses.flatMap((s) => (s.kind === 'applied' ? [s.row.id] : [])),
)
/** 日志里存在、但 hash 对不上任何迁移文件当前内容的行（含重复行与外部种入行）。 */
const unmatchedRows = rows.filter((r) => !claimed.has(r.id))

// ── 报告 ────────────────────────────────────────────────────────
const problems =
  orderProblems.length +
  statuses.filter((s) => s.kind !== 'applied' || s.whenDrift).length +
  unmatchedRows.length

console.log(`迁移文件 ${entries.length} 条，日志表 ${rows.length} 行\n`)
for (const s of statuses) {
  let badge: string
  let extra = ''
  if (s.kind === 'applied') {
    badge = s.whenDrift ? '⚠️  applied*    ' : '✅ applied     '
    if (s.whenDrift) {
      extra = `（已记录且 hash 一致，但日志 created_at=${s.row.created_at} ≠ 文件 when=${s.entry.when}）`
    }
  } else {
    badge = '❌ not-recorded'
    extra =
      '（当前文件内容在日志里找不到对应记录：该文件在应用后被改过，或日志为外部种入）'
  }
  console.log(`${badge} ${s.entry.tag.padEnd(34)} ${extra}`)
}

if (orderProblems.length > 0) {
  console.log('\n❌ when 未严格递增（会导致迁移被静默跳过）：')
  for (const p of orderProblems) console.log(`   - ${p}`)
}
if (unmatchedRows.length > 0) {
  console.log(
    `\n⚠️  日志表有 ${unmatchedRows.length} 行的 hash 与任何迁移文件的当前内容都不对应` +
      '（重复行 / 历史遗留行 / 文件被改动前的记录）：',
  )
  for (const o of unmatchedRows.slice(0, 40)) {
    console.log(
      `   - id=${o.id} created_at=${o.created_at} hash=${o.hash.slice(0, 12)}…`,
    )
  }
  if (unmatchedRows.length > 40) {
    console.log(`   … 另有 ${unmatchedRows.length - 40} 行`)
  }
}

const apply = process.argv.includes('--apply')

if (problems === 0) {
  console.log('\n✅ 日志表与迁移文件完全一致（24 条一一对应，无重复、无遗留）')
  await sql.close()
  process.exit(0)
}

console.log(`\n共发现 ${problems} 处偏差。`)

if (!apply) {
  console.log(`
如需对账（把日志表重新基线化为当前迁移文件：每条迁移保留一行，
hash/created_at 取文件当前值，删除重复与遗留行）：

  bun run db:verify-migrations -- --apply

对账会改写 drizzle.__drizzle_migrations（迁移器的跳过判定只依赖 created_at，
改写后不影响本库状态；详见 docs/migration-journal.md）。
`)
  await sql.close()
  process.exit(1)
}

console.log('\n⌛ 开始对账（单个事务内完成）…')
await sql.begin(async (tx) => {
  await tx`DELETE FROM drizzle.__drizzle_migrations`
  for (const e of entries) {
    await tx`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${e.fileHash}, ${e.when})`
  }
})
const after = (await sql`
  SELECT count(*)::int AS c FROM drizzle.__drizzle_migrations
`) as Array<{ c: number }>
console.log(`✅ 对账完成：日志表现有 ${after[0]?.c} 行（= 迁移文件数 ${entries.length}）`)
console.log('   请再跑一次只读校验确认：bun run db:verify-migrations')
await sql.close()
process.exit(0)
