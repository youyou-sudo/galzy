#!/usr/bin/env bun
/**
 * 从 apps/web/src/routes 下的 .tsx 路由文件推导路由清单，并解析动态段真实 ID。
 *
 * 用法：
 *   bun scripts/parity/route-manifest.ts \
 *     --out .parity/routes.json --api http://127.0.0.1:3001 \
 *     --base http://127.0.0.1:3101 [--override .parity/routes.override.json] [--refresh]
 *
 * 动态段解析（真实数据来自本机 API）：
 *   $id（顶层）    → /games/gamelist 的第一条作品（vXXXX）
 *   $tagId        → /tags/hub 热门标签的第一条（gXXXX）
 *   $pid          → /producer/search?q=a 的第一条（pXXXX）
 *   $id（/collections 下）→ /collections 的第一条
 *   $topicId      → /topics 的第一条
 *   $articleId    → /strategy/gamestrategys?gameId=<gameId> 的第一条
 *   $categoryKey  → character（固定分类键）
 *
 * 覆盖配置（.parity/routes.override.json）可改 base、增删路由、覆盖参数：
 *   {
 *     "base": "http://127.0.0.1:3101",
 *     "exclude": ["/openapi"],
 *     "params": { "$pid": "p82", "collectionId": "38" },
 *     "routes": [{ "path": "/games", "query": "q=sakura", "name": "games-search" }]
 *   }
 */
import { ensureDir, parseArgs, readJson, relPath, writeJson, workspaceRoot } from './lib/util'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

type RouteEntry = {
  path: string
  name: string
  kind: 'public' | 'auth' | 'protected' | 'admin'
  dynamic: boolean
  params: Record<string, string>
  unresolvedParams: string[]
  expectStatus?: number
  expectFinalPath?: string
  query?: string
  source?: string
  variants?: string[]
  note?: string
}

type Override = {
  base?: string
  exclude?: string[]
  params?: Record<string, string>
  routes?: Array<Partial<RouteEntry> & { path: string }>
  fallback?: Record<string, string>
}

const ROUTES_DIR = 'apps/web/src/routes'

const NAME_OVERRIDES: Record<string, string> = {
  '/': 'home',
  '/games': 'games',
  '/tags': 'tags-hub',
  '/tags/$tagId': 'tag-detail',
  '/tags/category/$categoryKey': 'tag-category',
  '/producer': 'producer-list',
  '/producer/$pid': 'producer-detail',
  '/collections': 'collections',
  '/collections/$id': 'collection-detail',
  '/topics': 'topics',
  '/topics/$topicId': 'topic-detail',
  '/topics/create': 'topic-create',
  '/topics/$topicId/edit': 'topic-edit',
  '/user': 'user',
  '/search': 'search',
  '/tools': 'tools',
  '/tools/plate': 'tools-plate',
  '/openapi': 'openapi',
  '/contact': 'contact',
  '/friend-links': 'friend-links',
  '/$id': 'game-detail',
  '/$id/comment': 'game-comment',
  '/$id/relations': 'game-relations',
  '/$id/translate': 'game-translate',
  '/$id/introduction': 'game-introduction',
  '/$id/introduction/$articleId': 'game-introduction-detail',
  '/introduction/create': 'introduction-create',
  '/introduction/$articleId/edit': 'introduction-edit',
  '/auth/login': 'auth-login',
  '/auth/signup': 'auth-signup',
  '/auth/signup/Verification': 'auth-signup-verification',
  '/admin': 'admin-home',
}

const AUTH_PATHS = new Set(['/auth/login', '/auth/signup', '/auth/signup/Verification'])
const PROTECTED_PATHS = new Set([
  '/topics/create',
  '/topics/$topicId/edit',
  '/user',
  '/introduction/create',
  '/introduction/$articleId/edit',
])

/** 递归收集 routes 目录下的 .tsx 文件。 */
function collectRouteFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      out.push(...collectRouteFiles(full))
    } else if (name.endsWith('.tsx')) {
      out.push(full)
    }
  }
  return out
}

/** 从文件内容提取 createFileRoute/createRootRoute 的 route id。 */
function extractRouteIds(content: string): string[] {
  const ids: string[] = []
  const fileRoute = /createFileRoute\(\s*['"]([^'"]+)['"]\s*\)/g
  let match: RegExpExecArray | null
  while ((match = fileRoute.exec(content))) ids.push(match[1])
  if (/createRootRoute/.test(content)) ids.push('/')
  return ids
}

/** route id → URL path：去掉 pathless 布局段（_layout/_authL）。 */
function routeIdToPath(id: string): string {
  const segments = id.split('/').filter(Boolean)
  const kept = segments.filter((segment) => !segment.startsWith('_'))
  return '/' + kept.join('/')
}

function isApiRoute(file: string): boolean {
  return file.replace(/\\/g, '/').includes('/routes/api/')
}

type ApiFetcher = (path: string) => Promise<unknown>

function createFetcher(apiBase: string): ApiFetcher {
  return async (path: string) => {
    const response = await fetch(apiBase.replace(/\/+$/, '') + path, {
      signal: AbortSignal.timeout(15000),
      headers: { accept: 'application/json' },
    })
    if (!response.ok) throw new Error('API ' + path + ' 返回 ' + response.status)
    return await response.json()
  }
}

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn()
  } catch (error) {
    console.warn('  解析失败（将使用 fallback）: ' + String(error))
    return null
  }
}

async function resolveParams(options: {
  api: ApiFetcher
  overrideParams: Record<string, string>
}): Promise<Record<string, string>> {
  const { api, overrideParams } = options
  const resolved: Record<string, string> = {}

  const game = await safe(async () => {
    const data = (await api('/games/gamelist?pageIndex=0&pageSize=12')) as {
      items?: Array<{ id?: string; images?: { url?: string | null } }>
    }
    const items = data.items ?? []
    const withImage = items.find((item) => item.id && item.images?.url)
    return withImage?.id ?? items[0]?.id ?? null
  })
  if (game) resolved['$id'] = game

  const tag = await safe(async () => {
    const data = (await api('/tags/hub?limit=1&sort=views&order=desc')) as {
      categories?: Array<{ previewTags?: Array<{ id?: string }> }>
    }
    return data.categories?.[0]?.previewTags?.[0]?.id ?? null
  })
  if (tag) resolved['$tagId'] = tag

  const producer = await safe(async () => {
    const data = (await api('/producer/search?q=a&limit=20')) as Array<{ id?: string }>
    return Array.isArray(data) ? (data[0]?.id ?? null) : null
  })
  if (producer) resolved['$pid'] = producer

  const collection = await safe(async () => {
    const data = (await api('/collections?pageIndex=0&pageSize=10')) as {
      items?: Array<{ id?: number }>
    }
    return data.items?.[0]?.id != null ? String(data.items[0].id) : null
  })
  if (collection) resolved['collectionId'] = collection

  const topic = await safe(async () => {
    const data = (await api('/topics?pageIndex=0&pageSize=10')) as {
      topics?: Array<{ id?: number }>
    }
    return data.topics?.[0]?.id != null ? String(data.topics[0].id) : null
  })
  if (topic) resolved['$topicId'] = topic

  if (resolved['$id']) {
    const article = await safe(async () => {
      const data = (await api(
        '/strategy/gamestrategys?gameId=' + encodeURIComponent(resolved['$id']),
      )) as Array<{ id?: number }>
      return Array.isArray(data) && data[0]?.id != null ? String(data[0].id) : null
    })
    if (article) resolved['$articleId'] = article
  }

  resolved['$categoryKey'] = 'character'

  Object.assign(resolved, overrideParams)
  return resolved
}

/** 按路由上下文给 $id / $articleId 取正确的值（collections 下的 $id 是合集 id）。 */
function resolveParamValue(
  routePath: string,
  param: string,
  resolved: Record<string, string>,
): string | null {
  if (param === '$id' && routePath.startsWith('/collections/')) {
    return resolved['collectionId'] ?? null
  }
  return resolved[param] ?? null
}

function fallbackName(path: string): string {
  if (NAME_OVERRIDES[path]) return NAME_OVERRIDES[path]
  const slug = path
    .replace(/^\//, '')
    .replace(/\$(\w+)/g, '$1')
    .replace(/\//g, '-')
  return slug || 'home'
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2), ['out', 'api', 'base', 'override'])
  const values = parsed.values
  const root = workspaceRoot()
  const outFile = resolve(values.get('out') ?? join(root, '.parity', 'routes.json'))
  const overridePath = resolve(values.get('override') ?? join(root, '.parity', 'routes.override.json'))
  const apiBase = values.get('api') ?? 'http://127.0.0.1:3001'
  const override: Override = existsSync(overridePath) ? readJson<Override>(overridePath) : {}
  const base = values.get('base') ?? override.base ?? 'http://127.0.0.1:3000'

  const routesDir = join(root, ROUTES_DIR)
  if (!existsSync(routesDir)) {
    throw new Error('找不到路由目录: ' + routesDir)
  }

  console.log('扫描路由: ' + ROUTES_DIR)
  const files = collectRouteFiles(routesDir).filter((file) => !isApiRoute(file))
  const seen = new Map<string, { path: string; source: string; ids: string[] }>()

  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    const ids = extractRouteIds(content)
    if (ids.length === 0) continue
    for (const id of ids) {
      const path = routeIdToPath(id)
      const existing = seen.get(path)
      if (existing) {
        // 同一 URL 有布局 + index 两条路由时，保留 index（source 里带 index）
        const isIndex = /\/index\.tsx$/.test(file) || file.endsWith('__root.tsx')
        const existingIsIndex = /\/index\.tsx$/.test(existing.source)
        if (isIndex && !existingIsIndex) {
          seen.set(path, { path, source: relative(root, file), ids })
        }
        continue
      }
      seen.set(path, { path, source: relative(root, file), ids })
    }
  }

  console.log('解析动态段真实 ID（API: ' + apiBase + '）...')
  const api = createFetcher(apiBase)
  const resolved = await resolveParams({ api, overrideParams: override.params ?? {} })
  const fallbackParams: Record<string, string> = override.fallback ?? {}

  const entries: RouteEntry[] = []
  const unresolved: string[] = []

  for (const { path, source } of [...seen.values()].sort((a, b) => a.path.localeCompare(b.path))) {
    if (path.startsWith('/api/') || path === '/api') continue
    const dynamic = /\$\w+/.test(path)
    const params: Record<string, string> = {}
    const unresolvedParams: string[] = []
    for (const segment of path.split('/')) {
      if (!segment.startsWith('$')) continue
      const value = resolveParamValue(path, segment, { ...resolved, ...fallbackParams })
      if (value) params[segment.slice(1)] = value
      else unresolvedParams.push(segment)
    }
    if (unresolvedParams.length > 0) unresolved.push(path + ' → ' + unresolvedParams.join(','))

    const kind: RouteEntry['kind'] =
      path === '/admin' || path.startsWith('/admin/')
        ? 'admin'
        : AUTH_PATHS.has(path)
          ? 'auth'
          : PROTECTED_PATHS.has(path)
            ? 'protected'
            : 'public'

    const entry: RouteEntry = {
      path,
      name: NAME_OVERRIDES[path] ?? fallbackName(path),
      kind,
      dynamic,
      params,
      unresolvedParams,
      source,
    }
    if (kind === 'admin' || kind === 'protected') {
      entry.expectFinalPath = '/auth/login'
      entry.expectStatus = 200
    } else {
      entry.expectStatus = 200
    }
    entries.push(entry)
  }

  // 覆盖配置：排除 + 修改 + 追加
  const exclude = new Set(override.exclude ?? [])
  const byPath = new Map<string, RouteEntry>()
  for (const entry of entries) {
    if (exclude.has(entry.path) || exclude.has(entry.name)) continue
    byPath.set(entry.path, entry)
  }
  for (const patch of override.routes ?? []) {
    const existing = byPath.get(patch.path)
    if (patch.skip) {
      byPath.delete(patch.path)
      continue
    }
    byPath.set(patch.path, {
      path: patch.path,
      name: patch.name ?? existing?.name ?? fallbackName(patch.path),
      kind: patch.kind ?? existing?.kind ?? 'public',
      dynamic: /\$\w+/.test(patch.path),
      params: { ...(existing?.params ?? {}), ...(patch.params ?? {}) },
      unresolvedParams: [],
      expectStatus: patch.expectStatus ?? existing?.expectStatus ?? 200,
      expectFinalPath: patch.expectFinalPath ?? existing?.expectFinalPath,
      query: patch.query ?? existing?.query,
      source: existing?.source ?? 'override',
      variants: patch.variants ?? existing?.variants,
      note: patch.note,
    })
  }

  const finalRoutes = [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path))
  const counts = {
    total: finalRoutes.length,
    public: finalRoutes.filter((route) => route.kind === 'public').length,
    auth: finalRoutes.filter((route) => route.kind === 'auth').length,
    protected: finalRoutes.filter((route) => route.kind === 'protected').length,
    admin: finalRoutes.filter((route) => route.kind === 'admin').length,
    dynamic: finalRoutes.filter((route) => route.dynamic).length,
  }

  const output = {
    generatedAt: new Date().toISOString(),
    source: ROUTES_DIR,
    api: apiBase,
    base,
    counts,
    resolvedParams: resolved,
    unresolved,
    routes: finalRoutes,
  }
  ensureDir(join(outFile, '..'))
  writeJson(outFile, output)

  console.log('')
  for (const route of finalRoutes) {
    const paramText = Object.entries(route.params)
      .map(([key, value]) => '$' + key + '=' + value)
      .join(' ')
    console.log(
      '  ' +
        route.kind.padEnd(9) +
        route.path.padEnd(34) +
        (paramText ? ' ' + paramText : '') +
        (route.expectFinalPath ? ' → ' + route.expectFinalPath : ''),
    )
  }
  console.log('')
  console.log(
    '共 ' +
      counts.total +
      ' 条路由：public ' +
      counts.public +
      ' / auth ' +
      counts.auth +
      ' / protected ' +
      counts.protected +
      ' / admin ' +
      counts.admin +
      '，动态 ' +
      counts.dynamic,
  )
  if (unresolved.length > 0) {
    console.log('仍有未解析的动态段（用 routes.override.json 的 params 补）：')
    for (const item of unresolved) console.log('  - ' + item)
  }
  console.log('已写入: ' + relPath(process.cwd(), outFile))
}

await main()
