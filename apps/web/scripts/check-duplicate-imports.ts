import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const projectDir: string = process.argv[2] || '.'
const fileExtensions: string[] = ['.js', '.jsx', '.ts', '.tsx']

function getAllFiles(dir: string, allFiles: string[] = []): string[] {
  let files: string[]
  try {
    files = fs.readdirSync(dir)
  } catch {
    return allFiles
  }

  for (const file of files) {
    const fullPath = path.join(dir, file)

    if (
      fullPath.includes('node_modules') ||
      path.basename(fullPath).startsWith('.')
    )
      continue

    let stat: fs.Stats
    try {
      stat = fs.statSync(fullPath)
    } catch {
      continue
    }

    if (stat.isDirectory()) {
      getAllFiles(fullPath, allFiles)
    } else if (fileExtensions.includes(path.extname(file))) {
      allFiles.push(fullPath)
    }
  }

  return allFiles
}

function checkFileForDuplicateImports(filePath: string): void {
  const code = fs.readFileSync(filePath, 'utf-8')

  const sourceFile = ts.createSourceFile(
    filePath,
    code,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') || filePath.endsWith('.jsx')
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS,
  )

  const importMap = new Map<string, ts.ImportDeclaration[]>()

  sourceFile.forEachChild((node) => {
    if (ts.isImportDeclaration(node)) {
      // 跳过类型导入：TypeScript 里 import type 会变成 ImportDeclaration，但可以用 isTypeOnly 判断
      if (node.importClause?.isTypeOnly) return

      const moduleSpecifier = node.moduleSpecifier.getText(sourceFile)
      // moduleSpecifier 是带引号的，比如 "'react'"，去掉引号
      const source = moduleSpecifier.slice(1, -1)

      if (!importMap.has(source)) {
        importMap.set(source, [])
      }
      importMap.get(source)?.push(node)
    }
  })

  for (const [source, imports] of importMap.entries()) {
    if (imports.length > 1) {
      console.log(`\n📄 文件: ${filePath}`)
      console.log(`🔁 检测到重复导入: '${source}' (${imports.length} 次)`)
      imports.forEach((imp, index) => {
        const { line } = sourceFile.getLineAndCharacterOfPosition(
          imp.getStart(),
        )
        console.log(
          `  ${index + 1}. 行 ${line + 1}: import { ... } from '${source}'`,
        )
      })
    }
  }
}

const allFiles = getAllFiles(projectDir)
allFiles.forEach(checkFileForDuplicateImports)
