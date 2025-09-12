import { lstat, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

// CLI 参数解析
const args = Object.fromEntries(
  process.argv.slice(2).reduce(
    (acc, arg, i, arr) => {
      if (arg.startsWith('--')) {
        const key = arg.slice(2)
        const value =
          arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true
        acc.push([key, value])
      }
      return acc
    },
    [] as [string, string | boolean][],
  ),
)

const basePath = path.resolve((args.dir as string) || process.cwd())
const outputPath = (args.out as string) || './output.json'

interface FileEntry {
  path: string
  name: string
  isFolder: boolean
  size: number
  isPlaceholder?: boolean
}
async function scanDirectory(dirPath: string): Promise<FileEntry[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const results: FileEntry[] = []

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    const isFolder = entry.isDirectory()

    const fileStat = await lstat(fullPath)
    const size = isFolder ? 0 : fileStat.size

    const relativeParent = path.relative(basePath, dirPath)
    const normalizedParent =
      relativeParent === ''
        ? '/'
        : '/' + relativeParent.split(path.sep).join('/')

    const isPlaceholder =
      (fileStat as any).isSymbolicLink?.() || (fileStat as any).reparsePoint

    results.push({
      path: normalizedParent,
      name: entry.name,
      isFolder,
      size,
      isPlaceholder,
    })

    if (isFolder) {
      const children = await scanDirectory(fullPath)
      results.push(...children)
    }
  }

  return results
}

;(async () => {
  console.log(`📂 正在扫描目录: ${basePath}`)
  const result = await scanDirectory(basePath)

  await writeFile(outputPath, JSON.stringify(result, null, 2), 'utf-8')
  console.log(`✅ 扫描完成，已写入到: ${outputPath}`)
})()
