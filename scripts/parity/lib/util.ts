/** parity 工具共用的最小工具集（无第三方依赖）。 */
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 简易命令参数解析：--key value / --key=value / --flag。 */
export type ParsedArgs = {
  flags: Set<string>
  values: Map<string, string>
  positional: string[]
}

export function parseArgs(argv: string[], flagsWithValue: string[]): ParsedArgs {
  const flags = new Set<string>()
  const values = new Map<string, string>()
  const positional: string[] = []
  const needsValue = new Set(flagsWithValue)
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) {
      positional.push(arg)
      continue
    }
    const body = arg.slice(2)
    const eq = body.indexOf('=')
    if (eq !== -1) {
      const key = body.slice(0, eq)
      values.set(key, body.slice(eq + 1))
      continue
    }
    if (needsValue.has(body)) {
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) {
        values.set(body, '')
      } else {
        values.set(body, next)
        i++
      }
      continue
    }
    flags.add(body)
  }
  return { flags, values, positional }
}

/** 把路由 path 转成稳定的文件名 slug。 */
export function slugifyRoute(path: string, query?: string): string {
  const trimmed = path.replace(/^\/+|\/+$/g, '')
  let slug = trimmed === '' ? 'root' : trimmed
  slug = slug
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  if (query) {
    const q = query.replace(/^\?/, '').replace(/[^a-zA-Z0-9._=-]+/g, '-')
    if (q) slug += '__q-' + q
  }
  return slug || 'root'
}

export function ensureDir(dir: string): string {
  mkdirSync(dir, { recursive: true })
  return dir
}

export function readJson<T = unknown>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T
}

export function writeJson(file: string, value: unknown): void {
  ensureDir(dirname(file))
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

export function relPath(from: string, to: string): string {
  return relative(from, to).replace(/\\/g, '/')
}

/** 项目根目录（scripts/parity/lib -> ../../..）。 */
export function workspaceRoot(): string {
  return resolve(import.meta.dir, '..', '..', '..')
}

export function projectPath(...segments: string[]): string {
  return join(workspaceRoot(), ...segments)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** 带超时的 Promise 包装。 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label + ' 超时（' + ms + 'ms）')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export function assertFileExists(file: string, label: string): void {
  if (!existsSync(file)) {
    throw new Error(label + ' 不存在: ' + file)
  }
}
