#!/usr/bin/env bun
/**
 * 抽样同步 kungal 攻略（walkthrough）到本地库 —— 页面验证 / 联调用的种子脚本。
 *
 * 为什么不直接调 POST /kungal-sync/walkthroughs：那个入口走的是「全表
 * galrc_kungal_works」口径（近 2000 部作品、上游 4000+ 条攻略），一次跑完
 * 对「把页面铺开看一眼」来说太重。这里只取「本地有 vndb 锚点、上游确实
 * 有攻略」的一小批作品，把条数钉在 --target 条左右（默认 350，足够铺满
 * 列表 / 详情 / 图表三块视图的验证面）。
 *
 * 口径：
 * 1. 先用 /catalog/walkthroughs 全局目录（不带 work_id）翻页，拿到上游
 *    「哪部作品有攻略」的真实分布 —— 盲扫本地 1991 部作品的话，绝大多数
 *    其实没有攻略，请求全白花；
 * 2. 只保留 work_id 命中本地、且本地有 vndb 锚点（能通过 /vNNN 打开页面）
 *    的作品 —— kungal-only 作品站内没有页面，同步了也看不到；
 * 3. v19073（千恋＊万花，kungal work 15）固定纳入，保证示例条目有数据；
 * 4. 落库复用 KungalSync.runWalkthroughStage，保证「列表 → 详情 chart →
 *    upsert → 清理上游已下线行」的逻辑与线上完全一致（含 jsonb 编码口径）；
 * 5. 只有「还不完整」的作品会重跑：库里已有行且 chart 都不为 NULL 的作品
 *    直接跳过，所以重复执行只补缺口。
 *
 * 上游限流：脚本自己不做 —— 一律走 libs/kungal-api 的 KungalClient（内置
 * 300 次/分 令牌桶 = 上游 600 次/分 配额的一半，429 有全局冷却退避）。
 * 凭证与限速只保留一份实现，脚本不自己发 fetch、也不自己读 key。
 *
 * 用法（在 apps/api 目录下，自动读 .env）：
 *   bun run scripts/sync-walkthrough-sample.ts --dry-run
 *   bun run scripts/sync-walkthrough-sample.ts --target=350
 *   bun run scripts/sync-walkthrough-sample.ts --refresh-plan    # 重新扫全局目录
 *
 * 参数：
 *   --target=<n>     目标攻略条数（默认 350，取到即停）
 *   --pages=<n>      全局目录最多翻多少页（默认 60 页 = 6000 条上限，防游标异常）
 *   --refresh-plan   忽略缓存的扫描计划，重新扫一遍全局目录
 *   --dry-run        只打印计划，不写库
 */
import { db } from '../src/db/client'
import { kungalWalkthroughs } from '../src/db/schema/kungal'
import { KungalClient } from '../src/libs/kungal-api'
import { KungalSync } from '../src/modules/kungal-sync/service'
import { inArray, sql } from 'drizzle-orm'

const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')
const argNum = (name: string, fallback: number) => {
  const raw = argv.find((a) => a.startsWith(`--${name}=`))
  const v = raw ? Number(raw.slice(name.length + 3)) : Number.NaN
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback
}
const TARGET = argNum('target', 350)
const MAX_PAGES = argNum('pages', 60)

// ---- 1. 本地作品（只取有 vndb 锚点的：站内能打开 /vNNN） ----
const localWorks = await db.execute<{
  id: string
  vndb_id: string
  display_name: string | null
}>(sql`select id, vndb_id, display_name from galrc_kungal_works where vndb_id is not null`)
const localById = new Map(localWorks.map((w) => [String(w.id), w]))
console.log(`本地有 vndb 锚点的 kungal 作品: ${localById.size}`)

// ---- 2. 扫描计划（缓存到 .dsh-tmp，重跑不必再翻全局目录） ----
const planPath = `${import.meta.dir}/../../../.dsh-tmp/walkthrough-plan.json`
const workIds = new Set<string>(['15']) // v19073 千恋＊万花 固定纳入
const picked = new Map<string, { id: string; workId: string }>()
let scanned = 0
let pages = 0
let hitLocal = 0
let cached = false

if (!argv.includes('--refresh-plan')) {
  try {
    const saved = (await Bun.file(planPath).json()) as {
      target: number
      workIds: string[]
      picked: Array<{ id: string; workId: string }>
      scanned: number
      pages: number
      hitLocal: number
    }
    // 缓存与本次目标条数一致才复用（改了 --target 就重扫，保证样本量对得上）
    if (saved.target === TARGET) {
      cached = true
      scanned = saved.scanned
      pages = saved.pages
      hitLocal = saved.hitLocal
      for (const wid of saved.workIds) workIds.add(wid)
      for (const row of saved.picked) picked.set(row.id, row)
      console.log(
        `复用扫描计划: ${picked.size} 条 / ${workIds.size} 部作品（--refresh-plan 可重扫）`,
      )
    }
  } catch {
    // 没有缓存：走下面的扫描
  }
}

if (!cached) {
  // 翻全局目录：鉴权 / 限速 / 429 退避都在 KungalClient 里，这里只按目标条数
  // 收手。返回 true 让客户端提前结束翻页，不必为了几百条样本翻完整个目录。
  try {
    await KungalClient.fetchWalkthroughIndex({
      maxPages: MAX_PAGES,
      onPage: (rows) => {
        pages++
        for (const item of rows) {
          scanned++
          const workId = String(item.work_id)
          if (!localById.has(workId)) continue
          hitLocal++
          workIds.add(workId)
          picked.set(String(item.id), { id: String(item.id), workId })
        }
        return picked.size >= TARGET
      },
    })
  } catch (err) {
    // 翻满 --pages 还没追平：保留已收样本继续。客户端抛错是为了保护全量同步
    // 不误删本地行，抽样脚本没有这个约束。
    console.warn(`⚠️ 全局目录翻页中断（已收 ${scanned} 条）：`, err)
  }
}

if (!cached) {
  await Bun.write(
    planPath,
    JSON.stringify(
      {
        target: TARGET,
        workIds: [...workIds],
        picked: [...picked.values()],
        scanned,
        pages,
        hitLocal,
      },
      null,
      2,
    ),
  )
}

const summary = [...picked.values()]
console.log(
  `全局目录扫描: ${pages} 页 / ${scanned} 条，命中本地 ${hitLocal} 条；计划 ${summary.length} 条攻略 / ${workIds.size} 部作品`,
)
console.log(`目标条目: v19073 → kungal work 15 (${localById.get('15')?.display_name ?? '?'})`)

const before = await db.execute<{ wts: string; charts: string }>(
  sql`select count(*)::text as wts, count(chart)::text as charts from galrc_kungal_walkthroughs`,
)
console.log('同步前库内攻略:', JSON.stringify(before))

// ---- 3. 只跑「还不完整」的作品：库里已有行且 chart 都非 NULL 的直接跳过 ----
const planWorkIds = [...workIds]
const perWork = await db
  .select({
    workId: kungalWalkthroughs.workId,
    total: sql<number>`count(*)`.as('total'),
    withChart: sql<number>`count(${kungalWalkthroughs.chart})`.as('with_chart'),
  })
  .from(kungalWalkthroughs)
  .where(inArray(kungalWalkthroughs.workId, planWorkIds))
  .groupBy(kungalWalkthroughs.workId)
const done = new Map(perWork.map((r) => [r.workId, Number(r.total) === Number(r.withChart)]))
const residual = planWorkIds.filter((id) => done.get(id) !== true)
console.log(
  `其中已完整 ${planWorkIds.length - residual.length} 部，本轮要补 ${residual.length} 部`,
)

if (dryRun) {
  console.log('--dry-run：不写库，结束')
  process.exit(0)
}
if (residual.length === 0) {
  console.log('计划内作品都已完整，无需同步')
  process.exit(0)
}

// ---- 4. 复用线上的攻略阶段（列表 → 详情 chart → upsert → 清理下线行） ----
await KungalSync.runWalkthroughStage(
  { workIds: residual, standalone: true },
  (processed, total) => console.log(`  进度 ${processed}/${total} 部作品`),
)

// ---- 5. 收尾核对 ----
const after = await db.execute<{ wts: string; charts: string; works: string }>(
  sql`select count(*)::text as wts, count(chart)::text as charts, count(distinct work_id)::text as works from galrc_kungal_walkthroughs`,
)
console.log('同步后库内攻略:', JSON.stringify(after))

const v19073Rows = await db.execute(
  sql`select id, lang, source, ending_count, save_count, segment_count,
             jsonb_array_length(chart->'segments') as segments
        from galrc_kungal_walkthroughs where work_id = '15'`,
)
console.log('v19073 (work 15) 攻略行:', JSON.stringify(v19073Rows))
process.exit(0)