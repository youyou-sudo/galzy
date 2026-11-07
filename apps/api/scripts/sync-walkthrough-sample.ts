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
 * 上游限流：免费档按短窗口计，客户端内置的 20 req/s 令牌桶偏激进（实测
 * 连翻十几页、或连续拉详情就会 429）。脚本在这里把 globalThis.fetch 串行
 * 化并限速（默认 500ms/次 = 2 req/s），429 再按 Retry-After 退避重试，
 * 保证一次跑完不用人盯着。--interval=<ms> 可调。
 *
 * 用法（在 apps/api 目录下，自动读 .env）：
 *   bun run scripts/sync-walkthrough-sample.ts --dry-run
 *   bun run scripts/sync-walkthrough-sample.ts --target=350
 *   bun run scripts/sync-walkthrough-sample.ts --refresh-plan    # 重新扫全局目录
 *
 * 参数：
 *   --target=<n>     目标攻略条数（默认 350，取到即停）
 *   --pages=<n>      全局目录最多翻多少页（默认 60 页 = 6000 条上限，防游标异常）
 *   --interval=<ms>  上游请求最小间隔（默认 500，0 = 交给客户端 20 req/s 令牌桶）
 *   --refresh-plan   忽略缓存的扫描计划，重新扫一遍全局目录
 *   --dry-run        只打印计划，不写库
 */
import { db } from '../src/db/client'
import { kungalWalkthroughs } from '../src/db/schema/kungal'
import { KungalSync } from '../src/modules/kungal-sync/service'
import { inArray, sql } from 'drizzle-orm'

const BASE = 'https://api.nextmoe.dev/v2'
const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')
const argNum = (name: string, fallback: number) => {
  const raw = argv.find((a) => a.startsWith(`--${name}=`))
  const v = raw ? Number(raw.slice(name.length + 3)) : Number.NaN
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback
}
const TARGET = argNum('target', 350)
const MAX_PAGES = argNum('pages', 60)
const INTERVAL_MS = argNum('interval', 500)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * 全局请求限速 + 429 退避。
 *
 * 客户端（libs/kungal-api）只有 20 req/s 的令牌桶，没有对上游短窗口配额的
 * 认识；同步阶段又是「10 个作品并发列表 + 一串详情」的突发形状，很容易整批
 * 429。这里在最外层包一层：所有请求串行排队、间隔 INTERVAL_MS，遇到 429 就
 * 按 Retry-After（缺省指数退避）重试。只影响本脚本进程。
 */
function installPacedFetch() {
  if (INTERVAL_MS <= 0) return
  const real = globalThis.fetch
  let lastAt = 0
  let queue: Promise<unknown> = Promise.resolve()
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const run = queue.then(async () => {
      const wait = Math.max(0, lastAt + INTERVAL_MS - Date.now())
      if (wait > 0) await sleep(wait)
      lastAt = Date.now()
      for (let attempt = 1; attempt <= 6; attempt++) {
        const res = await real(input, init)
        if (res.status !== 429) return res
        const retryAfter = Number(res.headers.get('retry-after') ?? 0) * 1000
        const wait2 = retryAfter > 0 ? retryAfter : 2000 * attempt
        console.log(`  ⏳ 429（第 ${attempt} 次），${Math.round(wait2 / 1000)}s 后重试`)
        await sleep(wait2)
      }
      throw new Error(`上游连续 429：${String(input)}`)
    })
    queue = run.catch(() => undefined)
    return await run
  }) as typeof fetch
}

function authHeaders(): Record<string, string> {
  const raw = process.env.KUNGALAPI_KEY ?? ''
  const tokens = raw
    .split(/[\s,]+/)
    .map((t) => t.replace(/^["']+|["']+$/g, '').trim())
    .filter(Boolean)
  const key = tokens.find((t) => t.startsWith('nmk_')) ?? tokens[0]
  if (!key) throw new Error('KUNGALAPI_KEY 未配置')
  return { Authorization: `Bearer ${key}` }
}

/** 全局攻略目录一页（带 work_id、不含 chart）。 */
async function fetchWalkthroughPage(cursor?: string): Promise<{
  items?: Array<{ id: string; work_id: string }>
  next_cursor?: string
}> {
  const params = new URLSearchParams({ nsfw: 'true', limit: '100' })
  if (cursor) params.set('cursor', cursor)
  const res = await fetch(`${BASE}/catalog/walkthroughs?${params.toString()}`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`kungal ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return (await res.json()) as {
    items?: Array<{ id: string; work_id: string }>
    next_cursor?: string
  }
}

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

installPacedFetch()

let cursor: string | undefined
while (!cached && pages < MAX_PAGES) {
  const page = await fetchWalkthroughPage(cursor)
  pages++
  for (const item of page.items ?? []) {
    scanned++
    const workId = String(item.work_id)
    if (!localById.has(workId)) continue
    hitLocal++
    workIds.add(workId)
    picked.set(String(item.id), { id: String(item.id), workId })
  }
  if (picked.size >= TARGET) break
  cursor = page.next_cursor
  if (!cursor) break
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