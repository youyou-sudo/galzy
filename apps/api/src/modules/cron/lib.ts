// 原始数据项类型
interface RawDataItem {
  parent: string
  name: string
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

// 扩展的数据项（包含完整路径和vid）
interface ExtendedItem extends RawDataItem {
  fullPath: string
  vid: string
}

// 提取 [vndb-vxxx] 中的 vxxx
function extractVid(str: string): string | null {
  const match = str.match(/\[vndb-v(\d+)\]/)
  return match ? `v${match[1]}` : null
}

// 构建完整路径（parent + name）
function buildFullPath(item: RawDataItem): string {
  const parent = item.parent.endsWith('/')
    ? item.parent.slice(0, -1)
    : item.parent
  return `${parent}/${item.name}`
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
        fullPath: buildFullPath(item),
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
    vidMap.get(item.vid)!.add(item.fullPath)

    // 查找所有以当前条目路径为前缀的其他条目（即子路径）
    for (const otherItem of items) {
      if (otherItem.fullPath === item.fullPath) continue

      // 如果 otherItem 是当前条目的子路径，也添加到集合中
      if (otherItem.fullPath.startsWith(item.fullPath + '/')) {
        vidMap.get(item.vid)!.add(otherItem.fullPath)
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
