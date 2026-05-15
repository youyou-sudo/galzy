import { db } from '@api/libs'

const viddata = await db
  .selectFrom('galrc_alistb')
  .where('vid', '=', 'v10')
  .selectAll()
  .executeTakeFirst()

type RawItem = {
  name: string
  size: number
  is_dir: boolean
  type: number
}

export type TreeNode = {
  id: string
  name: string
  type: 'folder' | 'file'
  size?: string
  format?: string
  volumes?: boolean
  children?: TreeNode[]
  redame?: string
}

const fetchList = async (parent: string): Promise<RawItem[]> => {
  const res = await fetch(`${process.env.OPENLIST_HOST}/api/fs/list`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `${process.env.OPENLIST_API_KEY}`,
    },
    body: JSON.stringify({
      path: parent,
      password: '',
      refresh: false,
      page: 1,
      per_page: 100000,
    }),
  })

  const json = await res.json()
  return json.data?.content || []
}

// 简单 size 格式化
const formatSize = (size: number) => {
  if (!size) return '0B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(1)}${units[i]}`
}

const buildTree = async (parent: string): Promise<TreeNode[]> => {
  const list = await fetchList(parent)

  const mdMap = new Map<string, string>()
  for (const item of list) {
    if (!item.is_dir && item.name.endsWith('.md')) {
      const base = item.name.replace(/\.md$/, '')
      mdMap.set(base, `${parent}/${item.name}`)
    }
  }

  // 先构建 node（不递归）
  const nodes: TreeNode[] = list
    .filter((item) => !(!item.is_dir && item.name.endsWith('.md')))
    .map((item) => {
      const node: TreeNode = {
        id: `${parent}/${item.name}`,
        name: item.name,
        type: item.is_dir ? 'folder' : 'file',
      }

      if (!item.is_dir) {
        node.size = formatSize(item.size)
        node.format = item.name.split('.').pop()
      }

      if (mdMap.has(item.name)) {
        node.redame = mdMap.get(item.name)
      }

      return node
    })

  // 👉 并行处理子目录
  await Promise.all(
    nodes.map(async (node) => {
      if (node.type === 'folder') {
        node.children = await buildTree(node.id)
      }
    }),
  )

  return nodes
}

export const buildAllTrees = async (paths: string[]): Promise<TreeNode[]> => {
  return Promise.all(
    paths.map(async (p) => {
      const tree = await buildTree(p)

      return {
        id: p,
        name: p.split('/').pop() ?? '',
        type: 'folder' as const,
        children: tree,
      }
    }),
  )
}
console.log(viddata?.path)
// if (!viddata?.path) return []
const data = viddata?.path ? await buildAllTrees([viddata.path]) : []
console.log(data)
