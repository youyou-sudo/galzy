#!/usr/bin/env bun
/**
 * UI 平价基线截图采集器。
 *
 * 用法：
 *   bun scripts/parity/capture.ts --base http://127.0.0.1:3101 --out .parity/baseline \
 *     --manifest .parity/routes.json --variants desktop-light,desktop-dark,mobile-light --concurrency 3
 *
 *   bun scripts/parity/capture.ts --base http://127.0.0.1:3100 --out /tmp/shot \
 *     --routes /,/games,/v9995 --width 1440 --height 900 --theme light
 *
 * 每条路由产出：全页 PNG + outerHTML，索引写入 <out>/index.json。
 */
import { launchBrowser, probeBrowser, type BrowserSession } from './lib/browser'
import { PageSession, type CaptureResult, type RouteSpec, type ThemeMode, type VariantSpec } from './lib/page'
import {
  ensureDir,
  formatBytes,
  parseArgs,
  readJson,
  relPath,
  sleep,
  slugifyRoute,
  writeJson,
} from './lib/util'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

type ManifestEntry = {
  path: string
  name?: string
  params?: Record<string, string>
  query?: string
  expectStatus?: number
  expectFinalPath?: string
  variants?: string[]
  skip?: boolean
}
type Manifest = { base?: string; routes?: ManifestEntry[] }

const ARG_VALUES = [
  'base',
  'out',
  'manifest',
  'routes',
  'width',
  'height',
  'theme',
  'concurrency',
  'variants',
  'browser',
  'retries',
  'timeout',
  'idle-ms',
  'max-page-height',
  'device-scale-factor',
  'skip',
  'only-variant',
  'label',
]

const PRESETS: Record<string, VariantSpec> = {
  'desktop-light': { name: 'desktop-light', width: 1440, height: 900, theme: 'light' },
  'desktop-dark': { name: 'desktop-dark', width: 1440, height: 900, theme: 'dark' },
  'mobile-light': { name: 'mobile-light', width: 390, height: 844, theme: 'light', mobile: true },
  'mobile-dark': { name: 'mobile-dark', width: 390, height: 844, theme: 'dark', mobile: true },
  'tablet-light': { name: 'tablet-light', width: 768, height: 1024, theme: 'light', mobile: true },
}

type Task = { variant: VariantSpec; route: ManifestEntry }

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2), ARG_VALUES)
  const values = parsed.values

  if (parsed.flags.has('help')) {
    printHelp()
    return
  }
  if (parsed.flags.has('check')) {
    const version = await probeBrowser(values.get('browser'))
    console.log('浏览器可用: ' + version)
    return
  }

  const base = values.get('base') ?? 'http://127.0.0.1:3000'
  const outDir = resolve(values.get('out') ?? '.parity/capture')
  const manifestPath = values.get('manifest') ? resolve(values.get('manifest')!) : null
  const concurrency = Math.max(1, Number(values.get('concurrency') ?? 3))
  const retries = Math.max(0, Number(values.get('retries') ?? 2))
  const timeout = Number(values.get('timeout') ?? 45000)
  const idleMs = Number(values.get('idle-ms') ?? 600)
  const maxPageHeight = Number(values.get('max-page-height') ?? 16384)
  const deviceScaleFactor = Number(values.get('device-scale-factor') ?? 1)
  const label = values.get('label') ?? ''

  const manifest: Manifest =
    manifestPath && existsSync(manifestPath) ? readJson<Manifest>(manifestPath) : { routes: [] }
  let routes: ManifestEntry[] = [...(manifest.routes ?? [])]

  const routeFilter = values.get('routes')
  if (routeFilter) {
    const wanted = routeFilter.split(',').map((item) => item.trim()).filter(Boolean)
    routes = wanted.map((wantedRoute) => {
      const found = routes.find(
        (entry) => entry.path === wantedRoute || entry.name === wantedRoute,
      )
      return found ?? { path: wantedRoute }
    })
  }
  if (routes.length === 0) {
    console.error('没有可采集的路由：请提供 --manifest 或 --routes')
    process.exit(2)
  }

  const skipPattern = values.get('skip')
  if (skipPattern) {
    const regex = new RegExp(skipPattern)
    routes = routes.filter((entry) => !regex.test(entry.path))
  }
  routes = routes.filter((entry) => !entry.skip)

  const variants = resolveVariants(values)
  const onlyVariant = values.get('only-variant')
  const effectiveVariants = onlyVariant
    ? variants.filter((variant) => variant.name === onlyVariant)
    : variants

  ensureDir(outDir)

  const tasks: Task[] = []
  for (const variant of effectiveVariants) {
    for (const route of routes) {
      if (route.variants && route.variants.length > 0 && !route.variants.includes(variant.name)) {
        continue
      }
      tasks.push({ variant, route })
    }
  }

  console.log(
    '采集 ' +
      tasks.length +
      ' 个页面（' +
      routes.length +
      ' 路由 × ' +
      effectiveVariants.length +
      ' 变体），并发 ' +
      concurrency +
      '，输出 ' +
      outDir,
  )

  const results: CaptureResult[] = []
  const startedAt = Date.now()
  let finished = 0
  const total = tasks.length
  let queueIndex = 0

  const worker = async (workerId: number): Promise<void> => {
    let session: BrowserSession | null = null
    let page: PageSession | null = null

    const ensureSession = async (): Promise<{ session: BrowserSession; page: PageSession }> => {
      if (!session || !page) {
        session = await launchBrowser({
          browserPath: values.get('browser'),
          width: effectiveVariants[0].width,
          height: effectiveVariants[0].height,
        })
        page = new PageSession(session.cdp, {
          deviceScaleFactor,
          routeTimeoutMs: timeout,
          idleMs,
          maxPageHeight,
          hideAds: !parsed.flags.has('keep-ads'),
        })
        page.setBaseUrl(base)
        await page.prepare()
      }
      return { session, page }
    }

    const restart = async (): Promise<void> => {
      try {
        await session?.close()
      } catch {
        /* ignore */
      }
      session = null
      page = null
    }

    try {
      await ensureSession()
    } catch (error) {
      console.error('[worker ' + workerId + '] 浏览器启动失败: ' + String(error))
      return
    }

    while (true) {
      const index = queueIndex++
      if (index >= tasks.length) break
      const task = tasks[index]
      const slug = slugifyRoute(task.route.path, task.route.query)
      const prefix = join(outDir, task.variant.name, slug)
      ensureDir(join(outDir, task.variant.name))

      let result: CaptureResult | null = null
      let lastError: string | null = null
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const ctx = await ensureSession()
          result = await ctx.page.capture(task.route, task.variant, prefix)
          const transient5xx = result.error !== null && /HTTP 5\d\d/.test(result.error)
          const knownStatus = task.route.expectStatus
          const expectedFailure =
            knownStatus !== undefined && result.status !== null && result.status === knownStatus
          if (
            result.error === null ||
            (!transient5xx && !retryable(result.error)) ||
            expectedFailure
          ) {
            break
          }
          lastError = result.error
          console.warn(
            '[' +
              task.variant.name +
              '] ' +
              task.route.path +
              ' 第 ' +
              (attempt + 1) +
              ' 次失败: ' +
              result.error +
              '，重试中',
          )
          await sleep(transient5xx ? 1500 : 400)
          await restart()
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error)
          console.warn(
            '[' +
              task.variant.name +
              '] ' +
              task.route.path +
              ' 第 ' +
              (attempt + 1) +
              ' 次异常: ' +
              lastError,
          )
          await restart()
        }
      }

      if (!result) {
        result = emptyResult(task, lastError ?? '未知错误')
      }
      results.push(result)
      finished++
      const status = result.error ? 'FAIL' : 'ok'
      const size = result.bytes.png > 0 ? formatBytes(result.bytes.png) : '-'
      console.log(
        '[' +
          finished +
          '/' +
          total +
          '] ' +
          status +
          ' ' +
          task.variant.name +
          ' ' +
          task.route.path +
          ' → ' +
          (result.status ?? '?') +
          ' ' +
          size +
          ' ' +
          result.durationMs +
          'ms' +
          (result.warnings.length ? ' ⚠' + result.warnings.length : ''),
      )
    }

    await restart()
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, (_, i) => worker(i))
  await Promise.all(workers)

  const finishedAt = Date.now()
  let ordered = orderResults(results, effectiveVariants, routes)
  let combinedVariants = effectiveVariants
  let combinedRoutes = routes

  // --merge：把本次结果合并进已有 index.json（分批采集 dark/mobile 时用），
  // 同一 (变体, 路由) 以本次为准，旧批次的其他变体保留。
  if (parsed.flags.has('merge')) {
    const previousPath = join(outDir, 'index.json')
    if (existsSync(previousPath)) {
      const previous = readJson<{
        variants?: VariantSpec[]
        captures?: Array<Record<string, unknown>>
      }>(previousPath)
      const previousVariants = previous.variants ?? []
      const previousCaptures = previous.captures ?? []
      const map = new Map<string, CaptureResult>()
      for (const raw of previousCaptures) {
        const item = raw as unknown as Record<string, unknown>
        const viewport = item.viewport as CaptureResult['viewport']
        const key = variantKey(viewport.width, viewport.height, viewport.theme) + '|' + String(item.route)
        map.set(key, {
          ...(item as unknown as CaptureResult),
          screenshotPath: item.screenshot ? join(outDir, String(item.screenshot)) : null,
          htmlPath: item.html ? join(outDir, String(item.html)) : null,
        })
      }
      for (const item of ordered) {
        const key =
          variantKey(item.viewport.width, item.viewport.height, item.viewport.theme) + '|' + item.route
        map.set(key, item)
      }
      const variantSeen = new Set<string>()
      combinedVariants = [...previousVariants, ...effectiveVariants].filter((variant) => {
        const key = variantKey(variant.width, variant.height, variant.theme)
        if (variantSeen.has(key)) return false
        variantSeen.add(key)
        return true
      })
      const routeSeen = new Set<string>()
      const routeOrder = [...previousCaptures.map((c) => String(c.route)), ...routes.map((r) => r.path)]
      combinedRoutes = routeOrder
        .filter((path) => {
          if (routeSeen.has(path)) return false
          routeSeen.add(path)
          return true
        })
        .map((path) => routes.find((route) => route.path === path) ?? { path })
      const merged: CaptureResult[] = []
      for (const variant of combinedVariants) {
        for (const route of combinedRoutes) {
          const found = map.get(variantKey(variant.width, variant.height, variant.theme) + '|' + route.path)
          if (found) merged.push(found)
        }
      }
      ordered = merged
    }
  }

  const summary = buildSummary(ordered, combinedRoutes)

  const index = {
    schemaVersion: 1,
    capturedAt: new Date(finishedAt).toISOString(),
    baseUrl: base,
    label,
    durationMs: finishedAt - startedAt,
    variants: combinedVariants,
    routeCount: combinedRoutes.length,
    captureCount: ordered.length,
    summary,
    captures: ordered.map((item) => ({
      ...item,
      screenshot: item.screenshotPath ? relPath(outDir, item.screenshotPath) : null,
      html: item.htmlPath ? relPath(outDir, item.htmlPath) : null,
    })),
  }
  writeJson(join(outDir, 'index.json'), index)
  writeJson(join(outDir, 'meta.json'), {
    schemaVersion: 1,
    baseUrl: base,
    capturedAt: index.capturedAt,
    label,
    variants: combinedVariants,
    routeCount: combinedRoutes.length,
    captureCount: ordered.length,
    manifest: manifestPath ? relPath(process.cwd(), manifestPath) : null,
  })

  console.log('')
  console.log(
    '完成：' +
      ordered.length +
      ' 张截图，失败 ' +
      summary.failed +
      ' 条，用时 ' +
      ((finishedAt - startedAt) / 1000).toFixed(1) +
      's',
  )
  if (summary.failed > 0) {
    console.log('失败列表：')
    for (const item of ordered.filter((entry) => entry.error)) {
      console.log(
        '  - [' +
          item.viewport.theme +
          '/' +
          item.viewport.width +
          '] ' +
          item.route +
          ': ' +
          item.error,
      )
    }
  }
  console.log('索引: ' + join(outDir, 'index.json'))

  if (parsed.flags.has('fail-on-error') && summary.failed > 0) process.exit(1)
}

function retryable(message: string): boolean {
  return /超时|timeout|导航失败|连接已关闭|WebSocket|Target closed|net::ERR/i.test(message)
}

function emptyResult(task: Task, error: string): CaptureResult {
  return {
    route: task.route.path,
    url: '',
    finalUrl: '',
    finalPath: '',
    title: '',
    status: null,
    statuses: [],
    redirected: false,
    resolvedTheme: 'unknown',
    viewport: {
      width: task.variant.width,
      height: task.variant.height,
      deviceScaleFactor: 1,
      mobile: Boolean(task.variant.mobile),
      theme: task.variant.theme,
    },
    pageSize: { width: 0, height: 0 },
    screenshotPath: null,
    htmlPath: null,
    bytes: { png: 0, html: 0 },
    durationMs: 0,
    warnings: [],
    error,
    textLength: 0,
    appError: null,
    timings: {},
  }
}

function variantKey(width: number, height: number, theme: string): string {
  return width + 'x' + height + '-' + theme
}

function orderResults(
  results: CaptureResult[],
  variants: VariantSpec[],
  routes: ManifestEntry[],
): CaptureResult[] {
  const byKey = new Map<string, CaptureResult>()
  for (const result of results) {
    const key =
      variantKey(result.viewport.width, result.viewport.height, result.viewport.theme) +
      '|' +
      result.route
    byKey.set(key, result)
  }
  const ordered: CaptureResult[] = []
  for (const variant of variants) {
    const key = variantKey(variant.width, variant.height, variant.theme)
    for (const route of routes) {
      const found = byKey.get(key + '|' + route.path)
      if (found) ordered.push(found)
    }
  }
  return ordered
}

function buildSummary(results: CaptureResult[], routes: ManifestEntry[]) {
  const expected = new Map(routes.map((route) => [route.path, route]))
  let failed = 0
  let redirected = 0
  const unexpected: string[] = []
  const redirectMismatch: string[] = []
  for (const result of results) {
    if (result.error) failed++
    if (result.redirected) redirected++
    const spec = expected.get(result.route)
    if (spec?.expectStatus && result.status !== spec.expectStatus) {
      unexpected.push(result.route + ' 期望 ' + spec.expectStatus + ' 实际 ' + result.status)
    }
    if (spec?.expectFinalPath && !result.finalPath.startsWith(spec.expectFinalPath)) {
      redirectMismatch.push(
        result.route + ' 期望跳转到 ' + spec.expectFinalPath + ' 实际 ' + result.finalPath,
      )
    }
  }
  return {
    failed,
    redirected,
    statusMismatch: unexpected,
    redirectMismatch,
    warnings: results.reduce((sum, item) => sum + item.warnings.length, 0),
  }
}

function resolveVariants(values: Map<string, string>): VariantSpec[] {
  const variantsArg = values.get('variants')
  if (variantsArg) {
    return variantsArg.split(',').map((raw) => {
      const name = raw.trim()
      if (PRESETS[name]) return { ...PRESETS[name] }
      const custom = /^([^=]+)=(\d+)x(\d+):(light|dark|auto)(m?)$/.exec(name)
      if (custom) {
        return {
          name: custom[1],
          width: Number(custom[2]),
          height: Number(custom[3]),
          theme: custom[4] as ThemeMode,
          mobile: custom[5] === 'm',
        }
      }
      throw new Error('未知变体: ' + name + '（可用: ' + Object.keys(PRESETS).join(', ') + '）')
    })
  }
  const width = values.get('width')
  const height = values.get('height')
  const theme = (values.get('theme') ?? 'light') as ThemeMode
  if (!width && !height && !values.get('theme')) {
    return [{ ...PRESETS['desktop-light'] }]
  }
  const variant: VariantSpec = {
    name: 'custom-' + (width ?? 1440) + 'x' + (height ?? 900) + '-' + theme,
    width: Number(width ?? 1440),
    height: Number(height ?? 900),
    theme,
    mobile: Number(width ?? 1440) <= 640,
  }
  return [variant]
}

function printHelp(): void {
  console.log(
    [
      'UI 平价基线截图采集',
      '',
      '选项：',
      '  --base URL               站点根地址（默认 http://127.0.0.1:3000）',
      '  --out DIR                输出目录（默认 .parity/capture）',
      '  --manifest FILE          路由清单 JSON（route-manifest.ts 产物）',
      '  --routes a,b,c           只采集指定路由（path 或 name）',
      '  --variants a,b,c         变体列表: ' + Object.keys(PRESETS).join(', '),
      '                           也支持 name=1440x900:dark 或 name=390x844:lightm 自定义',
      '  --width/--height/--theme 单变体快捷方式（theme: light|dark|auto）',
      '  --concurrency N          并发浏览器实例数（默认 3）',
      '  --retries N              单路由重试次数（默认 2）',
      '  --timeout MS             单路由超时（默认 45000）',
      '  --idle-ms MS             网络空闲判定窗口（默认 600）',
      '  --max-page-height PX     全页截图最大高度（默认 16384）',
      '  --device-scale-factor N  固定 DPR（默认 1，保证跨次可比）',
      '  --skip REGEX             跳过匹配的路由',
      '  --browser PATH           Chromium 可执行文件',
      '  --merge                  合并进已有 index.json（分批采集 dark/mobile 时用）',
      '  --keep-ads               不隐藏广告位内容（默认隐藏，避免随机广告造成差异）',
      '  --check                  只检查浏览器是否可用',
      '  --fail-on-error          有失败路由时退出码为 1',
      '',
    ].join('\n'),
  )
}

await main()
