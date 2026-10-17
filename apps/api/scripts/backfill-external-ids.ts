#!/usr/bin/env bun
/**
 * 一次性回填 galrc_external_ids：kungal work id + refs 外部锚点 → VNDB 展示身份。
 *
 * 目的：让旧 `/kgX` 链接与 bangumi / dlsite / getchu / erogamescape / curated / …
 * 外部 id 永久归一到 vndb 锚点（见 apps/api/src/libs/identity/CONTRACT.md §3）。
 * 数据来源：galrc_kungal_works（vndb_id 非空，约 1984 行）。
 *
 * 行为：
 * - 按 id keyset 分页（默认 500/页，避免一次拉全表）读 works；
 * - 每行展开：`kungal:<work.id>` + refs 里每个 `source:external_id`
 *   （跳过 source='vndb' 的 rNNN release 锚点、超 external_id 列宽 255 的 key）；
 * - 全量去重后按批调 `linkAliases`（多行 ON CONFLICT upsert，幂等）；
 * - `--dry-run` 只统计不写库（含与现有外部别名表的 new / update / same 对比）。
 *
 * 幂等：重复执行 = 0 新增、0 变更（除非 kungal 侧 refs 又变了）。
 *
 * 用法（在 apps/api 目录下，自动读 .env）：
 *   bun run scripts/backfill-external-ids.ts --dry-run
 *   bun run scripts/backfill-external-ids.ts
 *   bun run scripts/backfill-external-ids.ts --fix-refs
 *
 * 参数：
 *   --dry-run       只打印统计，不写库
 *   --fix-refs      顺带把历史「jsonb 里装 JSON 字符串」的 refs 修正成真 jsonb 数组
 *   --batch=<n>     每页 works 行数 / 每次 linkAliases 的对数（默认 500）
 *   --limit=<n>     只处理前 n 行 works（调试用）
 */
import { db, sql } from '../src/db/client'
import { linkAliases } from '../src/libs/identity/resolve'
import {
  type KungalAliasPair,
  parseRefs,
  refsToAliasPairs,
} from '../src/libs/kungal-api/normalize'

const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')
const fixRefs = argv.includes('--fix-refs')

function numberFlag(name: string, fallback: number): number {
  const raw = argv.find((arg) => arg.startsWith(`--${name}=`))
  const value = raw ? Number(raw.slice(name.length + 3)) : Number.NaN
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

const pageSize = numberFlag('batch', 500)
const limit = numberFlag('limit', Number.POSITIVE_INFINITY)
const VNDB_RE = /^v\d+$/i
const RELEASE_RE = /^r\d+$/i

/** linkAliases 的内部去重键口径：kind 小写、vndb 侧 external_id 小写。 */
function aliasKey(kind: string, externalId: string): string {
  const k = kind.toLowerCase()
  return `${k}\u0000${k === 'vndb' ? externalId.toLowerCase() : externalId}`
}

interface WorkRow {
  id: string
  vndb_id: string | null
  refs: unknown
}

interface RefShape {
  total: number
  scalar: number
  fixable: number
}

const pairsByKind = new Map<string, number>()
const aliases = new Map<string, KungalAliasPair>()
const canonicalByKey = new Map<string, Set<string>>()
let works = 0
let refsRows = 0
let refPairs = 0
let releaseAnchors = 0
let invalidVndb = 0
let unparsableRefs = 0
let pairAttempts = 0

function addPair(pair: KungalAliasPair) {
  const key = aliasKey(pair.kind, pair.externalId)
  pairAttempts++
  aliases.set(key, pair)
  pairsByKind.set(pair.kind, (pairsByKind.get(pair.kind) ?? 0) + 1)
  const canonicals = canonicalByKey.get(key) ?? new Set<string>()
  canonicals.add(pair.canonicalVid)
  canonicalByKey.set(key, canonicals)
}

async function readWorksPage(cursor: string): Promise<WorkRow[]> {
  const rows = await db.execute(sql`
    select id, vndb_id, refs
    from galrc_kungal_works
    where vndb_id is not null and id > ${cursor}
    order by id
    limit ${pageSize}`)
  return rows as unknown as WorkRow[]
}

async function readExistingAliases(): Promise<Map<string, string>> {
  const rows = await db.execute(sql`
    select kind, external_id, canonical_id from galrc_external_ids`)
  const out = new Map<string, string>()
  for (const row of rows as unknown as Array<{
    kind: string
    external_id: string
    canonical_id: string
  }>) {
    out.set(aliasKey(row.kind, row.external_id), row.canonical_id.toLowerCase())
  }
  return out
}

async function readRefsShape(): Promise<RefShape> {
  const rows = await db.execute(sql`
    select count(*)::int as total,
           count(*) filter (where jsonb_typeof(refs) = 'string')::int as scalar,
           count(*) filter (
             where jsonb_typeof(refs) = 'string'
               and (refs #>> '{}') ~ '^[[:space:]]*\\['
           )::int as fixable
    from galrc_kungal_works`)
  return (rows as unknown as RefShape[])[0]
}

async function fixDoubleEncodedRefs(): Promise<number> {
  const rows = await db.execute(sql`
    update galrc_kungal_works
    set refs = (refs #>> '{}')::jsonb
    where jsonb_typeof(refs) = 'string'
      and (refs #>> '{}') ~ '^[[:space:]]*\\['
    returning id`)
  return (rows as unknown as unknown[]).length
}

function printSummary(existing: Map<string, string>) {
  console.log('\n===== galrc_kungal_works =====')
  console.log(`works（vndb_id 非空，已扫描）: ${works}`)
  console.log(`refs 行数: ${refsRows}`)
  console.log(
    `跳过：vndb release 锚点 rNNN ${releaseAnchors}，超长/无效 refs ${refsRows - releaseAnchors - refPairs}`,
  )
  console.log(`跳过：vndb_id 非法 ${invalidVndb}，refs 无法解析 ${unparsableRefs}`)

  console.log('\n===== 别名对（去重后）=====')
  console.log(`总对数（含重复）: ${pairAttempts}`)
  console.log(`去重后唯一 key : ${aliases.size}`)
  for (const [kind, count] of [...pairsByKind.entries()].sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${kind.padEnd(14)} ${String(count).padStart(6)} 对`)
  }

  const conflicts = [...canonicalByKey.entries()].filter(
    ([, canonicals]) => canonicals.size > 1,
  )
  console.log(`\n同一外部 key 指向多个 vndb（后写覆盖）: ${conflicts.length}`)
  for (const [key, canonicals] of conflicts.slice(0, 5)) {
    const [kind, externalId] = key.split('\u0000')
    console.log(`  ${kind}:${externalId} → ${[...canonicals].join(' / ')}`)
  }

  console.log('\n===== 与现有 galrc_external_ids 对比 =====')
  let fresh = 0
  let changed = 0
  let same = 0
  for (const [key, pair] of aliases) {
    const current = existing.get(key)
    if (!current) fresh++
    else if (current === pair.canonicalVid.toLowerCase()) same++
    else changed++
  }
  console.log(`现有行数: ${existing.size}`)
  console.log(`将新增  : ${fresh}`)
  console.log(`将变更  : ${changed}`)
  console.log(`已一致  : ${same}`)
  console.log(`预期写入后总行数: ${existing.size + fresh}`)

  console.log('\n===== 样例（每 kind 前 2 条）=====')
  const seen = new Map<string, number>()
  for (const pair of aliases.values()) {
    const count = seen.get(pair.kind) ?? 0
    if (count >= 2) continue
    seen.set(pair.kind, count + 1)
    console.log(`  ${pair.kind}:${pair.externalId} → ${pair.canonicalVid}`)
  }
}

async function main() {
  console.log(
    `回填 galrc_external_ids${dryRun ? '（dry-run，不写库）' : ''}${fixRefs ? ' + 修正 refs 双编码' : ''}`,
  )

  const shapeBefore = await readRefsShape()
  const existing = await readExistingAliases()

  let cursor = ''
  while (works < limit) {
    const page = await readWorksPage(cursor)
    if (page.length === 0) break
    for (const row of page.slice(0, limit - works)) {
      works++
      cursor = row.id
      const vndbId = row.vndb_id?.trim().toLowerCase() ?? ''
      if (!VNDB_RE.test(vndbId)) {
        invalidVndb++
        continue
      }
      const refs = parseRefs(row.refs)
      if (row.refs !== null && refs.length === 0) unparsableRefs++
      refsRows += refs.length
      releaseAnchors += refs.filter(
        (ref) => ref.source === 'vndb' && RELEASE_RE.test(ref.external_id),
      ).length
      addPair({ kind: 'kungal', externalId: row.id, canonicalVid: vndbId })
      const refAliases = refsToAliasPairs(refs, vndbId)
      refPairs += refAliases.length
      for (const pair of refAliases) addPair(pair)
    }
    if (page.length < pageSize) break
  }

  console.log(`\n扫描完成：${works} 行 works，${aliases.size} 个唯一别名`)
  console.log(
    `refs 形态：${shapeBefore.scalar}/${shapeBefore.total} 行仍是双编码字符串（可自动修正 ${shapeBefore.fixable}）`,
  )

  if (dryRun) {
    printSummary(existing)
    if (fixRefs) {
      console.log(`\n[fix-refs --dry-run] 将修正 ${shapeBefore.fixable} 行 refs`)
    }
    console.log('\ndry-run 结束，未写库。')
    process.exit(0)
  }

  // 写别名：每 pageSize 对一次 upsert（单条多行，幂等）
  const pairs = [...aliases.values()]
  let written = 0
  for (let i = 0; i < pairs.length; i += pageSize) {
    const batch = pairs.slice(i, i + pageSize)
    await linkAliases(batch)
    written += batch.length
    if (i % (pageSize * 4) === 0) {
      console.log(`  别名写入进度: ${written}/${pairs.length}`)
    }
  }
  console.log(`✅ 别名写入完成: ${written} 对`)

  if (fixRefs) {
    try {
      const fixed = await fixDoubleEncodedRefs()
      console.log(`✅ refs 双编码修正: ${fixed} 行`)
    } catch (err) {
      console.error('❌ refs 修正失败（数据未改动，可手工处理）:', err)
    }
  }

  const after = await readExistingAliases()
  const shapeAfter = await readRefsShape()
  console.log(
    `\n外部别名表: ${existing.size} → ${after.size} 行（+${after.size - existing.size}）`,
  )
  console.log(`refs 双编码行: ${shapeBefore.scalar} → ${shapeAfter.scalar}`)
  printSummary(after)

  // 回读抽查：kungal 别名 → vndb
  const sample = await db.execute(sql`
    select kind, external_id, canonical_id
    from galrc_external_ids
    where kind = 'kungal'
    order by updated_at desc nulls last
    limit 5`)
  console.log('\n回读抽查（kind=kungal）：')
  for (const row of sample as unknown as Array<{
    kind: string
    external_id: string
    canonical_id: string
  }>) {
    console.log(`  ${row.kind}:${row.external_id} → ${row.canonical_id}`)
  }

  // 守卫：kungal 别名必须与 works.vndb_id 一致
  const mismatch = await db.execute(sql`
    select count(*)::int as n
    from galrc_kungal_works w
    join galrc_external_ids e
      on e.kind = 'kungal' and e.external_id = w.id
    where w.vndb_id is not null
      and lower(w.vndb_id) <> lower(e.canonical_id)`)
  console.log(
    `校验：kungal 别名与 works.vndb_id 不一致 ${(mismatch as unknown as Array<{ n: number }>)[0].n} 条`,
  )

  process.exit(0)
}

main().catch((err) => {
  console.error('❌ 回填失败:', err)
  process.exit(1)
})
