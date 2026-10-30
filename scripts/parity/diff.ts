#!/usr/bin/env bun
/**
 * 比较两个 capture 目录（基线 vs 迁移后），逐路由给出像素差异 + HTML 文本差异。
 *
 * 用法：
 *   bun scripts/parity/diff.ts \
 *     --baseline .parity/baseline --candidate .parity/candidate \
 *     --out .parity/reports/latest \
 *     --max-pixel-diff 0.5 --max-text-diff 1.0
 *
 * 退出码：
 *   0 = 全部在阈值内；1 = 有超阈值 / 缺失 / 状态或跳转不一致；2 = 参数或输入错误
 */
import { decodePng, diffImages, encodePng } from './lib/png'
import { diffLines, normalizeHtml } from './lib/html-text'
import { ensureDir, formatBytes, parseArgs, readJson, relPath, writeJson } from './lib/util'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

type CaptureRecord = {
  route: string
  variant?: string
  url: string
  finalUrl: string
  finalPath: string
  title: string
  status: number | null
  resolvedTheme: string
  viewport: { width: number; height: number; deviceScaleFactor: number; mobile: boolean; theme: string }
  pageSize: { width: number; height: number }
  screenshot: string | null
  html: string | null
  bytes: { png: number; html: number }
  warnings: string[]
  error: string | null
  textLength: number
  appError: string | null
  durationMs: number
}

type CaptureIndex = {
  schemaVersion: number
  capturedAt: string
  baseUrl: string
  label?: string
  variants: Array<{ name: string; width: number; height: number; theme: string; mobile?: boolean }>
  routeCount: number
  captureCount: number
  summary: Record<string, unknown>
  captures: CaptureRecord[]
}

type CompareResult = {
  route: string
  variant: string
  status: 'pass' | 'fail' | 'missing'
  reasons: string[]
  pixel: { ratio: number; diffPixels: number; totalPixels: number; meanDelta: number; sizeMismatch: boolean } | null
  text: { ratio: number; changed: number; total: number; added: string[]; removed: string[] } | null
  size: { baseline: string; candidate: string } | null
  statuses: { baseline: number | null; candidate: number | null }
  finalPaths: { baseline: string; candidate: string }
  titles: { baseline: string; candidate: string }
  warnings: { baseline: string[]; candidate: string[] }
  diffImage: string | null
  candidateError: string | null
}

const ARG_VALUES = [
  'baseline', 'candidate', 'out', 'max-pixel-diff', 'max-text-diff', 'tolerance',
  'variants', 'routes', 'max-diffs', 'label',
]

function variantKeyOf(record: { viewport: { width: number; height: number; theme: string } }): string {
  return record.viewport.width + 'x' + record.viewport.height + '-' + record.viewport.theme
}

function routeSlug(route: string): string {
  if (route === '/' || route === '') return 'root'
  return route.replace(/^\/+/, '').replace(/\//g, '__')
}

function normalizeTitle(title: string): string {
  return title.replace(/[0-9a-f]{8,}/gi, '<hash>').replace(/\d+/g, '#').replace(/\s+/g, ' ').trim()
}

function pathSignature(path: string): string {
  try {
    const parsed = new URL(path, 'http://x')
    const keys = [...parsed.searchParams.keys()].sort()
    return parsed.pathname + (keys.length > 0 ? '?' + keys.join('&') : '')
  } catch {
    return path
  }
}

function loadCaptureIndex(dir: string): CaptureIndex {
  const file = join(dir, 'index.json')
  if (!existsSync(file)) throw new Error('找不到 index.json: ' + file)
  const index = readJson<CaptureIndex>(file)
  if (!Array.isArray(index.captures)) throw new Error('index.json 缺少 captures 数组: ' + file)
  return index
}

function buildMap(index: CaptureIndex): Map<string, CaptureRecord> {
  const map = new Map<string, CaptureRecord>()
  for (const record of index.captures) {
    map.set(variantKeyOf(record) + '|' + record.route, record)
  }
  return map
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2), ARG_VALUES)
  const values = parsed.values
  if (parsed.flags.has('help') || !values.get('baseline')) {
    printHelp()
    process.exit(values.get('baseline') ? 0 : 2)
  }

  const baselineDir = resolve(values.get('baseline')!)
  const candidateDir = resolve(values.get('candidate') ?? '.')
  const outDir = resolve(values.get('out') ?? '.parity/reports/latest')
  const maxPixelDiff = Number(values.get('max-pixel-diff') ?? 0.5)
  const maxTextDiff = Number(values.get('max-text-diff') ?? 1.0)
  const tolerance = Number(values.get('tolerance') ?? 8)
  const maxDiffs = Number(values.get('max-diffs') ?? 10000)
  const allowMissing = parsed.flags.has('allow-missing')
  const writeAllDiffs = parsed.flags.has('write-all-diffs')

  const baseline = loadCaptureIndex(baselineDir)
  const candidate = loadCaptureIndex(candidateDir)
  const candidateMap = buildMap(candidate)

  const variantFilter = values.get('variants')?.split(',').map((item) => item.trim()).filter(Boolean)
  const routeFilter = values.get('routes')?.split(',').map((item) => item.trim()).filter(Boolean)

  ensureDir(outDir)
  const diffsDir = join(outDir, 'diffs')

  const results: CompareResult[] = []
  let diffImageCount = 0

  for (const base of baseline.captures) {
    const variantKey = variantKeyOf(base)
    // --variants 同时接受 "1440x900-dark"、主题名 "dark"、预设名 "desktop-dark"/"mobile-light"
    const variantMatches =
      !variantFilter ||
      variantFilter.some(
        (item) =>
          item === variantKey ||
          item === base.viewport.theme ||
          item === (base.viewport.mobile ? 'mobile-' : 'desktop-') + base.viewport.theme,
      )
    if (!variantMatches) continue
    if (routeFilter && !routeFilter.includes(base.route)) continue

    const cand = candidateMap.get(variantKey + '|' + base.route)
    const result: CompareResult = {
      route: base.route,
      variant: variantKey,
      status: 'pass',
      reasons: [],
      pixel: null,
      text: null,
      size: null,
      statuses: { baseline: base.status, candidate: null },
      finalPaths: { baseline: base.finalPath, candidate: '' },
      titles: { baseline: base.title, candidate: '' },
      warnings: { baseline: base.warnings, candidate: [] },
      diffImage: null,
      candidateError: null,
    }

    if (!cand) {
      result.status = allowMissing ? 'pass' : 'fail'
      result.reasons.push('候选目录缺少该路由')
      results.push(result)
      continue
    }

    result.statuses.candidate = cand.status
    result.finalPaths.candidate = cand.finalPath
    result.titles.candidate = cand.title
    result.warnings.candidate = cand.warnings
    result.candidateError = cand.error

    // 采集错误：两侧都以同一状态失败（例如迁移前就 500 的页面）不算回归，
    // 仍会继续做像素/文本比较；只有单侧失败才判失败。
    if (base.error && !cand.error) {
      result.reasons.push('基线采集失败但候选正常: ' + base.error)
    } else if (cand.error && !base.error) {
      result.reasons.push('候选采集失败而基线正常: ' + cand.error)
    } else if (base.error && cand.error && base.status !== cand.status) {
      result.reasons.push('两侧都失败但状态不同: ' + base.status + ' → ' + cand.status)
    }

    // 状态码 / 跳转目标 / 标题
    if (base.status !== cand.status) {
      result.reasons.push('状态码不同: ' + base.status + ' → ' + cand.status)
    }
    if (pathSignature(base.finalPath) !== pathSignature(cand.finalPath)) {
      result.reasons.push('最终路径不同: ' + base.finalPath + ' → ' + cand.finalPath)
    }
    if (normalizeTitle(base.title) !== normalizeTitle(cand.title)) {
      result.reasons.push('标题不同: "' + base.title + '" → "' + cand.title + '"')
    }

    // 像素比较
    if (base.screenshot && cand.screenshot) {
      const basePath = join(baselineDir, base.screenshot)
      const candPath = join(candidateDir, cand.screenshot)
      if (!existsSync(basePath)) {
        result.reasons.push('基线截图缺失: ' + base.screenshot)
      } else if (!existsSync(candPath)) {
        result.reasons.push('候选截图缺失: ' + cand.screenshot)
      } else {
        try {
          const a = decodePng(new Uint8Array(await Bun.file(basePath).arrayBuffer()))
          const b = decodePng(new Uint8Array(await Bun.file(candPath).arrayBuffer()))
          const { stats, diff } = diffImages(a, b, tolerance)
          result.pixel = {
            ratio: stats.diffRatio,
            diffPixels: stats.diffPixels,
            totalPixels: stats.totalPixels,
            meanDelta: stats.meanDelta,
            sizeMismatch: stats.sizeMismatch,
          }
          result.size = {
            baseline: stats.widthA + 'x' + stats.heightA,
            candidate: stats.widthB + 'x' + stats.heightB,
          }
          if (stats.sizeMismatch) {
            result.reasons.push(
              '截图尺寸不同: ' + stats.widthA + 'x' + stats.heightA + ' → ' + stats.widthB + 'x' + stats.heightB,
            )
          }
          const pixelPct = stats.diffRatio * 100
          if (pixelPct > maxPixelDiff) {
            result.reasons.push('像素差异 ' + pixelPct.toFixed(2) + '% > ' + maxPixelDiff + '%')
          }
          const shouldWrite = writeAllDiffs || pixelPct > maxPixelDiff || stats.sizeMismatch
          if (shouldWrite && diffImageCount < maxDiffs) {
            const file = join(diffsDir, variantKey, routeSlug(base.route) + '.png')
            ensureDir(join(diffsDir, variantKey))
            await Bun.write(file, encodePng(diff))
            result.diffImage = relPath(outDir, file)
            diffImageCount++
          }
        } catch (error) {
          result.reasons.push('像素比较失败: ' + String(error))
        }
      }
    } else if (base.screenshot && !cand.screenshot) {
      result.reasons.push('候选没有截图')
    }

    // HTML 文本比较
    if (base.html && cand.html) {
      const baseHtml = join(baselineDir, base.html)
      const candHtml = join(candidateDir, cand.html)
      if (existsSync(baseHtml) && existsSync(candHtml)) {
        const a = normalizeHtml(await Bun.file(baseHtml).text())
        const b = normalizeHtml(await Bun.file(candHtml).text())
        const textDiff = diffLines(a, b)
        result.text = {
          ratio: textDiff.ratio,
          changed: textDiff.changed,
          total: textDiff.total,
          added: textDiff.added,
          removed: textDiff.removed,
        }
        const textPct = textDiff.ratio * 100
        if (textPct > maxTextDiff) {
          result.reasons.push('文本差异 ' + textPct.toFixed(2) + '% > ' + maxTextDiff + '%')
        }
      }
    }

    if (base.pageSize.height !== cand.pageSize.height && result.size === null) {
      result.reasons.push('页面高度不同: ' + base.pageSize.height + ' → ' + cand.pageSize.height)
    }

    result.status = result.reasons.length === 0 ? 'pass' : 'fail'
    results.push(result)
  }

  // 汇总
  const variants = [...new Set(results.map((item) => item.variant))]
  const summary = variants.map((variant) => {
    const items = results.filter((item) => item.variant === variant)
    const failed = items.filter((item) => item.status === 'fail')
    const pixelRatios = items.map((item) => (item.pixel ? item.pixel.ratio : 0))
    const textRatios = items.map((item) => (item.text ? item.text.ratio : 0))
    return {
      variant,
      total: items.length,
      passed: items.length - failed.length,
      failed: failed.length,
      maxPixelPct: Math.max(0, ...pixelRatios) * 100,
      meanPixelPct: pixelRatios.reduce((sum, value) => sum + value, 0) / Math.max(1, pixelRatios.length) * 100,
      maxTextPct: Math.max(0, ...textRatios) * 100,
    }
  })

  const failedAll = results.filter((item) => item.status === 'fail')
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    baseline: { dir: baselineDir, baseUrl: baseline.baseUrl, capturedAt: baseline.capturedAt },
    candidate: { dir: candidateDir, baseUrl: candidate.baseUrl, capturedAt: candidate.capturedAt },
    thresholds: { maxPixelDiffPct: maxPixelDiff, maxTextDiffPct: maxTextDiff, pixelTolerance: tolerance },
    summary,
    totals: {
      routes: results.length,
      passed: results.length - failedAll.length,
      failed: failedAll.length,
      missing: results.filter((item) => item.status === 'missing').length,
    },
    results,
  }
  writeJson(join(outDir, 'report.json'), report)
  await Bun.write(join(outDir, 'report.md'), renderMarkdown(report))

  console.log('')
  for (const row of summary) {
    console.log(
      row.variant.padEnd(16) +
        ' 通过 ' + String(row.passed).padStart(3) + '/' + String(row.total).padEnd(3) +
        ' 最大像素 ' + row.maxPixelPct.toFixed(2) + '%' +
        ' 平均 ' + row.meanPixelPct.toFixed(2) + '%' +
        ' 最大文本 ' + row.maxTextPct.toFixed(2) + '%',
    )
  }
  console.log('')
  console.log('报告: ' + join(outDir, 'report.md'))
  console.log('JSON: ' + join(outDir, 'report.json'))
  if (failedAll.length > 0) {
    console.log('')
    console.log('未通过的路由（前 30 条）：')
    for (const item of failedAll.slice(0, 30)) {
      console.log('  - ' + item.variant + ' ' + item.route + ': ' + item.reasons.join('; '))
    }
  }
  process.exit(failedAll.length > 0 ? 1 : 0)
}

function renderMarkdown(report: {
  generatedAt: string
  baseline: { dir: string; baseUrl: string; capturedAt: string }
  candidate: { dir: string; baseUrl: string; capturedAt: string }
  thresholds: { maxPixelDiffPct: number; maxTextDiffPct: number; pixelTolerance: number }
  summary: Array<{ variant: string; total: number; passed: number; failed: number; maxPixelPct: number; meanPixelPct: number; maxTextPct: number }>
  totals: { routes: number; passed: number; failed: number; missing: number }
  results: CompareResult[]
}): string {
  const lines: string[] = []
  lines.push('# UI 平价报告')
  lines.push('')
  lines.push('- 生成时间: ' + report.generatedAt)
  lines.push('- 基线: ' + report.baseline.dir + ' (base ' + report.baseline.baseUrl + ', ' + report.baseline.capturedAt + ')')
  lines.push('- 候选: ' + report.candidate.dir + ' (base ' + report.candidate.baseUrl + ', ' + report.candidate.capturedAt + ')')
  lines.push(
    '- 阈值: 像素差异 ≤ ' + report.thresholds.maxPixelDiffPct + '%（单通道容差 ' +
      report.thresholds.pixelTolerance + '），文本差异 ≤ ' + report.thresholds.maxTextDiffPct + '%',
  )
  lines.push('')
  lines.push('## 汇总')
  lines.push('')
  lines.push('| 变体 | 路由 | 通过 | 未通过 | 最大像素差 | 平均像素差 | 最大文本差 |')
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: |')
  for (const row of report.summary) {
    lines.push(
      '| ' + row.variant + ' | ' + row.total + ' | ' + row.passed + ' | ' + row.failed + ' | ' +
        row.maxPixelPct.toFixed(2) + '% | ' + row.meanPixelPct.toFixed(2) + '% | ' + row.maxTextPct.toFixed(2) + '% |',
    )
  }
  lines.push('')
  lines.push('总计: ' + report.totals.routes + ' 条对比，通过 ' + report.totals.passed + '，未通过 ' + report.totals.failed)
  lines.push('')

  const failed = report.results.filter((item) => item.status === 'fail')
  lines.push('## 未通过明细')
  lines.push('')
  if (failed.length === 0) {
    lines.push('全部路由在阈值内 ✅')
  } else {
    lines.push('| 变体 | 路由 | 像素差 | 文本差 | 原因 | diff 图 |')
    lines.push('| --- | --- | ---: | ---: | --- | --- |')
    for (const item of failed) {
      const pixel = item.pixel ? (item.pixel.ratio * 100).toFixed(2) + '%' : '-'
      const text = item.text ? (item.text.ratio * 100).toFixed(2) + '%' : '-'
      lines.push(
        '| ' + item.variant + ' | ' + item.route + ' | ' + pixel + ' | ' + text + ' | ' +
          item.reasons.join('<br>') + ' | ' + (item.diffImage ? '[' + item.diffImage + '](' + item.diffImage + ')' : '-') + ' |',
      )
    }
  }
  lines.push('')

  const withText = report.results.filter((item) => item.text && item.text.changed > 0 && item.status === 'fail')
  if (withText.length > 0) {
    lines.push('## 文本差异样例')
    lines.push('')
    for (const item of withText.slice(0, 15)) {
      lines.push('### ' + item.variant + ' ' + item.route)
      lines.push('')
      if (item.text) {
        for (const line of item.text.removed.slice(0, 5)) lines.push('- 基线: ' + line)
        for (const line of item.text.added.slice(0, 5)) lines.push('- 候选: ' + line)
      }
      lines.push('')
    }
  }

  const withWarnings = report.results.filter(
    (item) => item.warnings.baseline.length > 0 || item.warnings.candidate.length > 0,
  )
  if (withWarnings.length > 0) {
    lines.push('## 采集告警（可能影响结论）')
    lines.push('')
    lines.push('| 变体 | 路由 | 基线告警 | 候选告警 |')
    lines.push('| --- | --- | --- | --- |')
    for (const item of withWarnings.slice(0, 40)) {
      lines.push(
        '| ' + item.variant + ' | ' + item.route + ' | ' +
          (item.warnings.baseline.join('<br>') || '-') + ' | ' + (item.warnings.candidate.join('<br>') || '-') + ' |',
      )
    }
    lines.push('')
  }

  lines.push('## 判定标准')
  lines.push('')
  lines.push('- 逐像素比较：单通道差值 > ' + report.thresholds.pixelTolerance + ' 记为不同像素；差异像素占比超过 ' + report.thresholds.maxPixelDiffPct + '% 即失败。')
  lines.push('- 文本比较：HTML 去脚本/样式/广告后按块取可见文本，数字、哈希、时间戳归一化，行级 LCS 差异比例超过 ' + report.thresholds.maxTextDiffPct + '% 即失败。')
  lines.push('- 状态码、最终路径（只比较 path 与 query key）、标题（数字归一化）必须一致。')
  lines.push('- 广告位、随机推荐、相对时间、浏览/点赞计数属于噪声，已从文本中剔除；像素上仍可能出现小幅差异。')
  lines.push('')
  return lines.join('\n')
}

function printHelp(): void {
  console.log(
    [
      'UI 平价比较（基线 vs 候选）',
      '',
      '选项：',
      '  --baseline DIR        基线 capture 目录（含 index.json）',
      '  --candidate DIR       候选 capture 目录（含 index.json）',
      '  --out DIR             报告输出目录（默认 .parity/reports/latest）',
      '  --max-pixel-diff PCT  像素差异上限百分比（默认 0.5）',
      '  --max-text-diff PCT   文本差异上限百分比（默认 1.0）',
      '  --tolerance N         单通道像素容差（默认 8，抗压缩/抗锯齿噪声）',
      '  --variants a,b        只比较指定变体',
      '  --routes a,b          只比较指定路由',
      '  --allow-missing       候选缺少路由时不判失败',
      '  --write-all-diffs     为所有路由写 diff 图（默认只写超阈值的）',
      '',
    ].join('\n'),
  )
}

await main()
