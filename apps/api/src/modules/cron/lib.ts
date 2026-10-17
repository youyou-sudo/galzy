// 原始数据项类型（Cloudreve 搜索结果项）
import { cloudreveUriToPath } from '@api/libs/cloudreve'

export interface RawDataItem {
  name: string
  /** 完整路径（Cloudreve 文件 URI，如 cloudreve://my/Games/[vndb-v123]） */
  path: string
  is_dir: boolean
  size: number
  type: number
}

/** 锚点类型：vndb 作品 / kungal work / 手工 other 条目 */
export type AnchorKind = 'vndb' | 'kungal' | 'other'

/** 从文件夹名解析出的锚点；id 对 kungal 保留原样大小写，对 vndb 小写化 */
export interface Anchor {
  kind: AnchorKind
  id: string
}

/** 按锚点归组后的路径集合（processData 的输出） */
export interface ProcessedAnchor extends Anchor {
  path: string[]
}

/**
 * 从文件夹名提取锚点。支持三种命名，优先级 vndb > kungal > other：
 * - `[vndb-v123]`  → { kind:'vndb',   id:'v123' }（大小写不敏感）
 * - `[kungal-X]`   → { kind:'kungal', id:'X' }   （kungal work id 大小写敏感，原样保留）
 * - `[other-xxx]`  → { kind:'other',  id:'xxx' }
 */
export function extractAnchor(str: string): Anchor | null {
  const vndb = str.match(/\[vndb-v(\d+)\]/i)
  if (vndb) return { kind: 'vndb', id: `v${vndb[1]}` }
  const kungal = str.match(/\[kungal-([^\]\s/]+)\]/i)
  if (kungal) return { kind: 'kungal', id: kungal[1] }
  const other = str.match(/\[other-(\w+)\]/i)
  if (other) return { kind: 'other', id: other[1] }
  return null
}

/** 锚点归组键：kungal 大小写不敏感归组，但保留首个出现的原始大小写作为 id */
function anchorKey(anchor: Anchor): string {
  return `${anchor.kind}\u0000${anchor.kind === 'vndb' ? anchor.id.toLowerCase() : anchor.id.toLowerCase()}`
}

// 去除有父子关系的路径（保留更短的父路径）
function removeParentChildPaths(paths: string[]): string[] {
  // 按路径长度升序排序
  const sorted = [...paths].sort((a, b) => a.length - b.length)
  const result: string[] = []

  for (const path of sorted) {
    // 检查当前路径是否是已保留路径中某个路径的子路径
    const isChild = result.some((existingPath) =>
      path.startsWith(existingPath + '/'),
    )
    if (!isChild) {
      result.push(path)
    }
  }

  return result
}

/**
 * 主处理函数：按锚点归组搜索结果，收集锚点自身路径与其所有子路径。
 *
 * 只产出 vndb / kungal 锚点（`[other-xxx]` 由 processAlistData 单独处理，
 * 不参与资源行同步，保持既有行为）。
 */
export function processData(data: RawDataItem[]): ProcessedAnchor[] {
  const items: Array<RawDataItem & { anchor: Anchor }> = data
    .map((item) => {
      const anchor = extractAnchor(item.name)
      if (!anchor || anchor.kind === 'other') return null
      return { ...item, anchor }
    })
    .filter((item): item is RawDataItem & { anchor: Anchor } => item !== null)

  const groups = new Map<string, { anchor: Anchor; paths: Set<string> }>()

  for (const item of items) {
    const key = anchorKey(item.anchor)
    const group = groups.get(key)
    if (group) {
      group.paths.add(item.path)
    } else {
      groups.set(key, {
        // 保留首个出现的原始写法（kungal id 大小写以网盘目录为准）
        anchor: item.anchor,
        paths: new Set([item.path]),
      })
    }

    // 该锚点的所有子路径（子目录/文件）也归属同一作品
    for (const otherItem of items) {
      if (otherItem.path === item.path) continue
      if (otherItem.path.startsWith(item.path + '/')) {
        groups.get(key)!.paths.add(otherItem.path)
      }
    }
  }

  const result: ProcessedAnchor[] = []
  for (const { anchor, paths } of groups.values()) {
    result.push({
      ...anchor,
      path: removeParentChildPaths(Array.from(paths)),
    })
  }
  return result
}

// ── 锚点 → 展示身份 ──────────────────────────────────

/** 已解析成 alistb 行的候选（按展示身份归并后的结果） */
export interface ResolvedRow {
  /** 展示身份，同时也是 alistb.id（'vNNN' 或 'kgX'） */
  id: string
  vid: string | null
  kungalId: string | null
  anchorKind: AnchorKind
  path: string[]
}

/**
 * 把锚点解析成「展示身份」并归并同一作品的多个文件夹。
 *
 * @param anchors        processData 输出
 * @param kungalDisplay  kungal work id（小写）→ 展示身份。值有两种：
 *   'vNNN'（该 work 已有 vndb 锚点）或 'kgX'（该 work 被合并到另一个 kungal work）。
 *   来源：galrc_kungal_works.vndb_id + galrc_external_ids(canonical_kind='kungal')。
 *
 * 关键：同一作品的 `[vndb-v123]` 与 `[kungal-X]`（X 已锚定 v123）会**归并成一行**，
 * 路径取并集 —— 这是"同一游戏永远不成两个条目"的核心保证。
 */
export function resolveAnchors(
  anchors: ProcessedAnchor[],
  kungalDisplay: Map<string, string>,
): ResolvedRow[] {
  const byDisplay = new Map<string, ResolvedRow>()

  for (const anchor of anchors) {
    let displayId: string
    let vid: string | null = null
    let anchorKind: AnchorKind = anchor.kind
    let kungalId: string | null = null

    if (anchor.kind === 'vndb') {
      vid = anchor.id.toLowerCase()
      displayId = vid
    } else if (anchor.kind === 'kungal') {
      kungalId = anchor.id
      const resolved = kungalDisplay.get(anchor.id.toLowerCase())
      if (resolved && /^v\d+$/i.test(resolved)) {
        // kungal 侧已有 vndb 锚点：直接落 vndb 行，绝不另建 kg 条目
        vid = resolved.toLowerCase()
        displayId = vid
        anchorKind = 'vndb'
      } else if (resolved) {
        // 该 kungal work 已被合并到另一个 kungal work（无 vndb 锚点）。
        // kungal_id 记归一口径的 work id，避免每次扫描在两个 canonical 之间来回改。
        displayId = resolved
        kungalId = kungalIdFromDisplayId(resolved) ?? anchor.id
      } else {
        // 目录里从未见过的 kungal work：展示身份统一小写，
        // 否则 `[kungal-New1]` 与 `[kungal-new1]` 会算出两个不同展示身份 → 重复条目。
        // （已知 work 走上面的 resolved 分支，用目录里的权威写法。）
        displayId = `kg${anchor.id.toLowerCase()}`
      }
    } else {
      displayId = anchor.id
    }

    const existing = byDisplay.get(displayId)
    if (existing) {
      existing.path.push(...anchor.path)
      if (kungalId && !existing.kungalId) existing.kungalId = kungalId
    } else {
      byDisplay.set(displayId, {
        id: displayId,
        vid,
        kungalId,
        anchorKind,
        path: [...anchor.path],
      })
    }
  }

  return [...byDisplay.values()].map((row) => ({
    ...row,
    path: removeParentChildPaths(row.path),
  }))
}

// ── Cloudreve ↔ alistb 差异计算 ──────────────────────

/** alistb 表中的一行（与同步相关的列） */
export interface AlistbRow {
  id: string
  vid: string | null
  other: number | null
  path: string[] | null
  anchorKind?: AnchorKind | string | null
  kungalId?: string | null
  displayId?: string | null
}

/** 需要写入 alistb 的行（新增 / 路径变更 / 锚点升级） */
export interface AlistbUpsertRow {
  id: string
  vid: string | null
  kungalId: string | null
  anchorKind: AnchorKind
  displayId: string
  other: null
  path: string[]
}

/**
 * 需要「改主键」的收口操作：先把 fromId 那行删掉，再 upsert row。
 * 出现在两类场景 ——
 * ① 文件夹改名（`[vndb-v10] 旧名` → `[vndb-v10] 新名` 且旧行主键不同）；
 * ② kungal 条目补到 vndb 锚点：`kgX` → `v123` 原地升级。
 * 两者都必须在同一事务内先删后写，否则唯一索引会拦下或留下两条可见条目。
 */
export interface RenameOp {
  fromId: string
  row: AlistbUpsertRow
}

/** 最近一次 Cloudreve 文件同步的统计（siteConfig.cloudreveSyncTime） */
export interface CloudreveSyncStats {
  lastUpdate: number
  foldersFound: number
  processedVids: number
  added: number
  updated: number
  kept: number
  deleted: number
  renamed: number
  tookMs: number
}

/** siteConfig 中 Cloudreve 同步统计的配置键（写方与读方共用，避免魔法字符串漂移） */
export const CLOUDREVE_SYNC_TIME_KEY = 'cloudreveSyncTime'

export interface CloudreveDiffResult {
  /** 待 upsert 的行（added + updated），path 已解码为 alistb 风格路径 */
  chunks: AlistbUpsertRow[]
  /** 需要先删旧主键再 upsert 的行（改名 / kungal→vndb 升级） */
  renames: RenameOp[]
  added: number
  updated: number
  unchanged: number
  renamed: number
  /** 搜索结果中出现但库里没有的条目（新增明细，用于报告） */
  addedRows: Array<{ displayId: string; paths: string[] }>
  /** 路径发生变更的条目（更新明细，用于报告） */
  updatedRows: Array<{
    displayId: string
    oldPaths: string[]
    newPaths: string[]
  }>
  /** 锚点升级/改名的明细 */
  renamedRows: Array<{ fromId: string; toId: string; paths: string[] }>
  /** 搜索结果缺失且所有存储路径均已确认不存在 → 删除 */
  toDelete: AlistbRow[]
  /** 搜索结果缺失但仍有路径存活 → 保留不动（避免搜索不完整时误删） */
  toKeep: AlistbRow[]
  staleDeadRows: Array<{ displayId: string; paths: string[] }>
  staleAliveRows: Array<{ displayId: string; paths: string[] }>
  /** 搜索结果里 kungal / vndb 锚点各自的文件夹命中数 */
  anchorHits: { vndb: number; kungal: number }
  /** 因锚点归并而合并的条目数（>0 说明存在同一作品的多种命名，已被收口） */
  collapsed: number
}

function samePaths(a: string[] | null | undefined, b: string[]): boolean {
  const x = [...(a ?? [])].sort()
  const y = [...b].sort()
  return x.length === y.length && x.every((p, i) => p === y[i])
}

/** 行的展示身份：优先 display_id，存量/未迁移数据退回 vid 或 id */
function displayIdOfRow(row: AlistbRow): string {
  return row.displayId ?? row.vid ?? row.id
}

/**
 * 计算 Cloudreve 搜索结果与 alistb 现有数据的差异。
 *
 * @param data        Cloudreve 搜索结果原始项（`[vndb-` 与 `[kungal-` 两批并集）
 * @param existing    alistb 当前全部行
 * @param pathExists  判断解码后路径在 Cloudreve 是否仍存在（目录存在返回 true）
 * @param kungalVndb  kungal work id（小写）→ vndb 锚点，用于把 kungal 命名归一到 vndb
 *
 * 安全性：搜索结果不完整（Cloudreve 搜索索引延迟/分页截断）时，
 * 不会仅凭“搜索没找到”就删除 alistb 行 —— 删除前逐一验证存储路径，
 * 只要有一个路径仍存活就保留该行。
 *
 * 一致性：同一展示身份在多处命名中出现时按「一个条目、多条路径」归并；
 * kungal 条目补到 vndb 锚点后以 rename 收口，不会产生第二条可见条目。
 */
export async function diffCloudreveData(
  data: RawDataItem[],
  existing: AlistbRow[],
  pathExists: (decodedPath: string) => Promise<boolean>,
  kungalDisplay: Map<string, string> = new Map(),
): Promise<CloudreveDiffResult> {
  const anchors = processData(data)
  const anchorHits = {
    vndb: anchors.filter((a) => a.kind === 'vndb').length,
    kungal: anchors.filter((a) => a.kind === 'kungal').length,
  }
  const resolved = resolveAnchors(anchors, kungalDisplay)
  const collapsed = Math.max(0, anchors.length - resolved.length)
  const freshDisplayIds = new Set(resolved.map((r) => r.id))

  const existingByDisplay = new Map<string, AlistbRow>()
  for (const row of existing) {
    existingByDisplay.set(displayIdOfRow(row), row)
  }

  const chunks: AlistbUpsertRow[] = []
  const renames: RenameOp[] = []
  const addedRows: CloudreveDiffResult['addedRows'] = []
  const updatedRows: CloudreveDiffResult['updatedRows'] = []
  const renamedRows: CloudreveDiffResult['renamedRows'] = []
  let added = 0
  let updated = 0
  let unchanged = 0
  let renamed = 0

  // 已被 rename 认领的旧行主键：后续 stale 判定里不要再走"保留/删除"逻辑
  const claimedOldIds = new Set<string>()

  for (const r of resolved) {
    // 搜索结果路径是百分号编码的裸路径，统一解码为 alistb 风格路径
    const newPaths = r.path.map(cloudreveUriToPath)
    const row: AlistbUpsertRow = {
      id: r.id,
      vid: r.vid,
      kungalId: r.kungalId,
      anchorKind: r.anchorKind,
      displayId: r.id,
      other: null,
      path: newPaths,
    }

    const direct = existingByDisplay.get(r.id)
    if (direct) {
      if (
        samePaths(direct.path, newPaths) &&
        (direct.vid ?? null) === r.vid &&
        (direct.kungalId ?? null) === r.kungalId
      ) {
        unchanged++
        continue
      }
      updated++
      updatedRows.push({
        displayId: r.id,
        oldPaths: direct.path ?? [],
        newPaths,
      })
      chunks.push(row)
      continue
    }

    // 找不到同展示身份的行：可能是改名/升级。旧行若由 kungal 锚点解析到本展示身份，
    // 就把它认领成"改主键"操作，而不是「新增一条 + 留下旧条目」。
    const renamedFrom = findRenameSource(
      existing,
      r,
      freshDisplayIds,
      kungalDisplay,
    )
    if (renamedFrom) {
      renamed++
      claimedOldIds.add(renamedFrom.id)
      renamedRows.push({
        fromId: displayIdOfRow(renamedFrom),
        toId: r.id,
        paths: newPaths,
      })
      renames.push({ fromId: renamedFrom.id, row })
      continue
    }

    added++
    addedRows.push({ displayId: r.id, paths: newPaths })
    chunks.push(row)
  }

  // 库中有条目但搜索结果缺失：先验证路径是否仍存在，再决定保留/删除。
  // 验证请求失败（网络/超时）视为"仍存在"保守保留 —— 只有 Cloudreve 明确返回
  // "路径不存在"（CloudreveError）才判定删除，避免瞬时故障导致批量误删。
  const toDelete: AlistbRow[] = []
  const toKeep: AlistbRow[] = []
  const staleDeadRows: CloudreveDiffResult['staleDeadRows'] = []
  const staleAliveRows: CloudreveDiffResult['staleAliveRows'] = []

  for (const row of existing) {
    const displayId = displayIdOfRow(row)
    if (freshDisplayIds.has(displayId)) continue
    if (claimedOldIds.has(row.id)) continue
    // 没有 vndb 也没有 kungal 锚点的旧手工行（other 条目）不参与自动删除
    if (!row.vid && !row.kungalId) continue

    const paths = row.path ?? []
    let alive = false
    for (const p of paths) {
      try {
        if (await pathExists(p)) {
          alive = true
          break
        }
      } catch {
        // 验证失败：保守保留，不删除
        alive = true
        break
      }
    }
    if (alive) {
      toKeep.push(row)
      staleAliveRows.push({ displayId, paths })
    } else {
      toDelete.push(row)
      staleDeadRows.push({ displayId, paths })
    }
  }

  return {
    chunks,
    renames,
    added,
    updated,
    unchanged,
    renamed,
    addedRows,
    updatedRows,
    renamedRows,
    toDelete,
    toKeep,
    staleDeadRows,
    staleAliveRows,
    anchorHits,
    collapsed,
  }
}

/**
 * 为新展示身份寻找"被它取代的旧行"（改名 / kungal→vndb 升级 / kungal 合并）。
 *
 * 判定：旧行的 kungal 锚点（或它当前展示身份里的 kg 锚点）经 kungalDisplay 解析后
 * 正好等于本展示身份，且旧展示身份已不在本次搜索结果里。
 * 对 kungal-only 的合并（kgOld → kgCurrent）同样成立，因此不会因为
 * "收口后 display_id 变了"而多出一条重复条目。
 */
function findRenameSource(
  existing: AlistbRow[],
  target: ResolvedRow,
  freshDisplayIds: Set<string>,
  kungalDisplay: Map<string, string>,
): AlistbRow | null {
  for (const row of existing) {
    const rowDisplay = displayIdOfRow(row)
    if (rowDisplay === target.id) continue
    // 旧展示身份仍出现在本次搜索结果里 → 不是改名，是另一条独立条目
    if (freshDisplayIds.has(rowDisplay)) continue

    const kungalId = row.kungalId ?? kungalIdFromDisplayId(rowDisplay)
    if (!kungalId) continue
    const resolved = kungalDisplay.get(kungalId.toLowerCase())
    if (resolved && resolved === target.id) return row
  }
  return null
}

/** 从 'kgX' 展示身份里取回 kungal work id（用于未回填 kungal_id 的存量行） */
function kungalIdFromDisplayId(displayId: string): string | null {
  const m = displayId.match(/^kg(.+)$/i)
  return m ? m[1] : null
}

/** 导出用于单测：展示身份归一并保持大小写规则 */
export function toDisplayId(anchor: Anchor, kungalVndb: Map<string, string>) {
  return resolveAnchors([{ ...anchor, path: [] }], kungalVndb)[0]?.id ?? null
}
