// 原始数据项类型（Cloudreve 搜索结果项）
import { cloudreveUriToPath } from '@api/libs/cloudreve'

interface RawDataItem {
  name: string
  /** 完整路径（Cloudreve 文件 URI，如 cloudreve://my/Games/[vndb-v123]） */
  path: string
  is_dir: boolean
  size: number
  type: number
}

// 处理后的输出类型
interface ProcessedItem {
  id: string
  vid: string
  other: null
  path: string[]
}

// 扩展的数据项（包含vid）
interface ExtendedItem extends RawDataItem {
  vid: string
}

// 提取 [vndb-vxxx] 中的 vxxx（大小写不敏感，兼容 [VNDB-vxxx] 等写法）
function extractVid(str: string): string | null {
  const match = str.match(/\[vndb-v(\d+)\]/i)
  return match ? `v${match[1]}` : null
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

// 主处理函数
export function processData(data: RawDataItem[]): ProcessedItem[] {
  // 先提取所有条目，并构建完整路径
  const items: ExtendedItem[] = data
    .map((item) => {
      const vid = extractVid(item.name)
      if (!vid) return null
      return {
        ...item,
        vid,
      }
    })
    .filter((item): item is ExtendedItem => item !== null)

  // 使用 Map 来按 vid 分组
  const vidMap = new Map<string, Set<string>>()

  for (const item of items) {
    if (!vidMap.has(item.vid)) {
      vidMap.set(item.vid, new Set())
    }
    // 添加当前条目的完整路径
    vidMap.get(item.vid)!.add(item.path)

    // 查找所有以当前条目路径为前缀的其他条目（即子路径）
    for (const otherItem of items) {
      if (otherItem.path === item.path) continue

      // 如果 otherItem 是当前条目的子路径，也添加到集合中
      if (otherItem.path.startsWith(item.path + '/')) {
        vidMap.get(item.vid)!.add(otherItem.path)
      }
    }
  }

  // 将 Map 转换为结果数组
  const result: ProcessedItem[] = []
  for (const [vid, pathSet] of vidMap.entries()) {
    const paths = Array.from(pathSet)
    // 去除有父子关系的路径
    const cleanedPaths = removeParentChildPaths(paths)

    result.push({
      id: vid,
      vid: vid,
      other: null,
      path: cleanedPaths,
    })
  }

  return result
}

// ── Cloudreve ↔ alistb 差异计算 ──────────────────────

/** alistb 表中的一行（与同步相关的列） */
export interface AlistbRow {
  id: string
  vid: string | null
  other: number | null
  path: string[] | null
}

/** 需要写入 alistb 的行（新增或路径变更）。processData 恒产出 other=null，类型如实标注 */
export interface AlistbUpsertRow {
  id: string
  vid: string
  other: null
  path: string[]
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
  tookMs: number
}

/** siteConfig 中 Cloudreve 同步统计的配置键（写方与读方共用，避免魔法字符串漂移） */
export const CLOUDREVE_SYNC_TIME_KEY = 'cloudreveSyncTime'

export interface CloudreveDiffResult {
  /** 待 upsert 的行（added + updated），path 已解码为 alistb 风格路径 */
  chunks: AlistbUpsertRow[]
  added: number
  updated: number
  unchanged: number
  /** 搜索结果中出现但库里没有的 vid（新增明细，用于报告） */
  addedRows: Array<{ vid: string; paths: string[] }>
  /** 路径发生变更的 vid（更新明细，用于报告） */
  updatedRows: Array<{ vid: string; oldPaths: string[]; newPaths: string[] }>
  /** 搜索结果缺失且所有存储路径均已确认不存在 → 删除 */
  toDelete: AlistbRow[]
  /** 搜索结果缺失但仍有路径存活 → 保留不动（避免搜索不完整时误删） */
  toKeep: AlistbRow[]
  staleDeadRows: Array<{ vid: string; paths: string[] }>
  staleAliveRows: Array<{ vid: string; paths: string[] }>
}

function samePaths(a: string[] | null | undefined, b: string[]): boolean {
  const x = [...(a ?? [])].sort()
  const y = [...b].sort()
  return x.length === y.length && x.every((p, i) => p === y[i])
}

/**
 * 计算 Cloudreve 搜索结果与 alistb 现有数据的差异。
 *
 * @param data        Cloudreve 搜索结果原始项
 * @param existing    alistb 当前全部行
 * @param pathExists  判断解码后路径在 Cloudreve 是否仍存在（目录存在返回 true）
 *
 * 安全性：搜索结果不完整（Cloudreve 搜索索引延迟/分页截断）时，
 * 不会仅凭“搜索没找到”就删除 alistb 行 —— 删除前逐一验证存储路径，
 * 只要有一个路径仍存活就保留该行。
 */
export async function diffCloudreveData(
  data: RawDataItem[],
  existing: AlistbRow[],
  pathExists: (decodedPath: string) => Promise<boolean>,
): Promise<CloudreveDiffResult> {
  const processed = processData(data)
  const freshVids = new Set(processed.map((r) => r.vid))

  const existingByVid = new Map<string, AlistbRow>()
  for (const row of existing) {
    if (row.vid) existingByVid.set(row.vid, row)
  }

  const chunks: AlistbUpsertRow[] = []
  const addedRows: CloudreveDiffResult['addedRows'] = []
  const updatedRows: CloudreveDiffResult['updatedRows'] = []
  let added = 0
  let updated = 0
  let unchanged = 0

  for (const r of processed) {
    // 搜索结果路径是百分号编码的裸路径，统一解码为 alistb 风格路径
    const newPaths = r.path.map(cloudreveUriToPath)
    const old = existingByVid.get(r.vid)

    if (!old) {
      added++
      addedRows.push({ vid: r.vid, paths: newPaths })
    } else if (!samePaths(old.path, newPaths)) {
      updated++
      updatedRows.push({ vid: r.vid, oldPaths: old.path ?? [], newPaths })
    } else {
      unchanged++
      continue
    }
    chunks.push({ id: r.id, vid: r.vid, other: r.other, path: newPaths })
  }

  // 库中有 vid 但搜索结果缺失的行：先验证路径是否仍存在，再决定保留/删除。
  // 验证请求失败（网络/超时）视为"仍存在"保守保留 —— 只有 Cloudreve 明确返回
  // "路径不存在"（CloudreveError）才判定删除，避免瞬时故障导致批量误删。
  const toDelete: AlistbRow[] = []
  const toKeep: AlistbRow[] = []
  const staleDeadRows: CloudreveDiffResult['staleDeadRows'] = []
  const staleAliveRows: CloudreveDiffResult['staleAliveRows'] = []

  for (const row of existing) {
    if (!row.vid || freshVids.has(row.vid)) continue
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
      staleAliveRows.push({ vid: row.vid, paths })
    } else {
      toDelete.push(row)
      staleDeadRows.push({ vid: row.vid, paths })
    }
  }

  return {
    chunks,
    added,
    updated,
    unchanged,
    addedRows,
    updatedRows,
    toDelete,
    toKeep,
    staleDeadRows,
    staleAliveRows,
  }
}
