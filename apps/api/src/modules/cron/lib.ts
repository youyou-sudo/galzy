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
// 例如：输入 ["/A/B", "/A/B/C", "/A/B/C/D"] 返回 ["/A/B"]
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

  // 为每个条目构建 path 数组
  const result: ProcessedItem[] = items.map((currentItem) => {
    const paths: string[] = []

    // 找出所有以当前条目路径为前缀的其他条目（即子路径）
    for (const otherItem of items) {
      // 跳过自身
      if (otherItem.fullPath === currentItem.fullPath) continue

      // 检查 otherItem 的完整路径是否以当前条目的完整路径为前缀
      // 这意味着 otherItem 是 currentItem 的子目录或更深层的内容
      if (otherItem.fullPath.startsWith(currentItem.fullPath + '/')) {
        paths.push(otherItem.fullPath)
      }
    }

    // 先添加自己的路径
    const allPaths = [currentItem.fullPath, ...paths]

    // 去除有父子关系的路径（保留最顶层的父路径）
    const cleanedPaths = removeParentChildPaths(allPaths)

    return {
      id: currentItem.vid,
      vid: currentItem.vid,
      other: null,
      path: cleanedPaths,
    }
  })

  return result
}
