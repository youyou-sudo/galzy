/**
 * Dev-only 能力探针：在 WebView 真机控制台一键输出能力矩阵与掉帧证据，
 * 用于裁决 "Chrome 111–124 缺 view-transition-class / fetchpriority" 等假设。
 *
 * 本模块仅在 dev 下由 __root.tsx 通过动态 import 引用，
 * prod 构建时静态条件 `import.meta.env.DEV` 为 false，整个模块会被 tree-shake。
 */

type UADataBrand = { brand: string; version: string }
type UADataLike = { platform?: string; brands?: UADataBrand[] }

interface ViewTransitionLike {
  ready: Promise<void>
  finished: Promise<void>
}

type DocumentWithStartViewTransition = Document & {
  startViewTransition?: (updateCallback: () => void) => ViewTransitionLike
}

interface ProbeRow {
  key: string
  value: string
}

let longtaskObserver: PerformanceObserver | null = null
let longtaskCount = 0
let longtaskTotalMs = 0
let longtaskMaxMs = 0

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function ensureLongtaskObserver(): void {
  if (longtaskObserver) return
  try {
    if (typeof PerformanceObserver === 'undefined') return
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longtaskCount += 1
        longtaskTotalMs += entry.duration
        if (entry.duration > longtaskMaxMs) longtaskMaxMs = entry.duration
      }
    })
    observer.observe({ type: 'longtask', buffered: true })
    longtaskObserver = observer
  } catch {
    longtaskObserver = null
  }
}

function collectEnvironmentRows(): ProbeRow[] {
  const rows: ProbeRow[] = []
  const push = (key: string, read: () => string) => {
    try {
      rows.push({ key, value: read() })
    } catch (error) {
      rows.push({ key, value: `检测失败: ${describeError(error)}` })
    }
  }

  push('userAgent', () => navigator.userAgent)
  push('chromeVersion', () => {
    const match = navigator.userAgent.match(/Chrome\/(\d+)/)
    return match ? match[1] : '未检测到'
  })
  push('uaData.platform', () => {
    const uaData = (navigator as Navigator & { userAgentData?: UADataLike })
      .userAgentData
    return uaData?.platform ?? '不存在'
  })
  push('uaData.brands', () => {
    const uaData = (navigator as Navigator & { userAgentData?: UADataLike })
      .userAgentData
    return (
      uaData?.brands?.map((b) => `${b.brand} ${b.version}`).join('; ') ??
      '不存在'
    )
  })
  push('document.startViewTransition', () =>
    typeof (document as DocumentWithStartViewTransition).startViewTransition,
  )
  push('requestIdleCallback', () => typeof requestIdleCallback)

  return rows
}

function collectCssSupportRows(): ProbeRow[] {
  const rows: ProbeRow[] = []
  const push = (key: string, read: () => boolean | null) => {
    try {
      const result = read()
      rows.push({
        key,
        value: result === null ? 'CSS.supports 不可用' : String(result),
      })
    } catch (error) {
      rows.push({ key, value: `检测失败: ${describeError(error)}` })
    }
  }

  push('css.view-transition-class', () =>
    CSS.supports('selector(::view-transition-group(.a))'),
  )
  push('css.backdrop-filter', () =>
    CSS.supports('backdrop-filter', 'blur(1px)'),
  )
  push('css.content-visibility', () =>
    CSS.supports('content-visibility', 'auto'),
  )
  push('css.mix-blend-mode:plus-lighter', () =>
    CSS.supports('mix-blend-mode', 'plus-lighter'),
  )
  push('css.color-mix', () =>
    CSS.supports('color', 'color-mix(in srgb, red, blue)'),
  )

  return rows
}

function collectFetchPriorityRow(): ProbeRow {
  try {
    if ('fetchpriority' in HTMLImageElement.prototype) {
      const descriptor = Object.getOwnPropertyDescriptor(
        HTMLImageElement.prototype,
        'fetchpriority',
      )
      return {
        key: 'img.fetchpriority',
        value: descriptor
          ? 'true (原型属性描述符存在: get/set)'
          : 'true (原型存在该键)',
      }
    }
    // React 渲染的是小写 fetchpriority 属性；若原型无该访问器，退化为 setAttribute 试验
    const img = document.createElement('img')
    img.setAttribute('fetchpriority', 'high')
    return {
      key: 'img.fetchpriority',
      value:
        img.getAttribute('fetchpriority') === 'high'
          ? 'false (setAttribute 回退: 属性可写，但无原型访问器)'
          : 'false (setAttribute 回退: 属性写入无效)',
    }
  } catch (error) {
    return { key: 'img.fetchpriority', value: `检测失败: ${describeError(error)}` }
  }
}

async function probeViewTransition(): Promise<ProbeRow[]> {
  const rows: ProbeRow[] = []
  try {
    const doc = document as DocumentWithStartViewTransition
    if (typeof doc.startViewTransition !== 'function') {
      rows.push({
        key: 'VT 行为',
        value: 'VT 不可用: document.startViewTransition 不存在',
      })
      return rows
    }

    const startedAt = performance.now()
    const transition = doc.startViewTransition(() => {})
    await transition.ready
    const readyMs = performance.now() - startedAt

    let vtAnimationCount: number
    try {
      vtAnimationCount = document.getAnimations().filter((animation) => {
        const effect = animation.effect as KeyframeEffect | null
        return (
          effect !== null &&
          typeof effect.pseudoElement === 'string' &&
          effect.pseudoElement.startsWith('::view-transition')
        )
      }).length
    } catch {
      vtAnimationCount = document.getAnimations().length
      rows.push({
        key: 'VT 伪元素统计',
        value: 'pseudoElement 读取抛错，退化为动画总数',
      })
    }

    rows.push({ key: 'VT ready 耗时', value: `${readyMs.toFixed(1)} ms` })
    rows.push({
      key: 'VT ::view-transition 动画数',
      value: String(vtAnimationCount),
    })

    await transition.finished
    rows.push({ key: 'VT 行为结论', value: 'VT 可用' })
  } catch (error) {
    rows.push({
      key: 'VT 行为结论',
      value: `VT 不可用: ${describeError(error)}`,
    })
  }
  return rows
}

function probeRequestIdleCallback(): Promise<ProbeRow[]> {
  return new Promise((resolve) => {
    let settled = false
    const settle = (row: ProbeRow) => {
      if (settled) return
      settled = true
      resolve([row])
    }
    try {
      if (typeof requestIdleCallback !== 'function') {
        settle({ key: 'requestIdleCallback 行为', value: 'API 不存在' })
        return
      }
      requestIdleCallback(
        (deadline) => {
          let remaining = -1
          try {
            remaining = deadline.timeRemaining()
          } catch {
            // timeRemaining 抛错时保持 -1
          }
          settle({
            key: 'requestIdleCallback 行为',
            value: `回调触发，timeRemaining()=${remaining.toFixed(1)} ms`,
          })
        },
        { timeout: 2000 },
      )
      setTimeout(() => {
        settle({
          key: 'requestIdleCallback 行为',
          value: '3 秒内未触发（主线程繁忙或被节流）',
        })
      }, 3000)
    } catch (error) {
      settle({
        key: 'requestIdleCallback 行为',
        value: `检测失败: ${describeError(error)}`,
      })
    }
  })
}

function collectLongtaskSnapshotRows(): ProbeRow[] {
  try {
    return [
      {
        key: 'longtask(截至当前)',
        value: `count=${longtaskCount}, 累计=${longtaskTotalMs.toFixed(1)} ms, 最大=${longtaskMaxMs.toFixed(1)} ms`,
      },
    ]
  } catch (error) {
    return [
      {
        key: 'longtask(截至当前)',
        value: `检测失败: ${describeError(error)}`,
      },
    ]
  }
}

/**
 * 收集能力矩阵并 console.table 输出。任何单项失败都被隔离，绝不向外抛错。
 */
export async function runCapabilityProbe(): Promise<void> {
  try {
    ensureLongtaskObserver()
    console.log('[galzy-probe] 环境与能力矩阵')
    console.table([
      ...collectEnvironmentRows(),
      ...collectCssSupportRows(),
      collectFetchPriorityRow(),
    ])

    const behaviorRows = await probeViewTransition()
    behaviorRows.push(...(await probeRequestIdleCallback()))
    behaviorRows.push(...collectLongtaskSnapshotRows())
    console.log('[galzy-probe] 行为级验证')
    console.table(behaviorRows)
  } catch (error) {
    console.warn('[galzy-probe] 探针整体失败', error)
  }
}

/**
 * 结束 longtask 观察并输出累计统计（累计时长与最大单次时长）。
 */
export function stopCapabilityProbe(): void {
  try {
    if (!longtaskObserver) {
      console.warn('[galzy-probe] 无活动的 longtask 观察器')
      return
    }
    longtaskObserver.disconnect()
    longtaskObserver = null
    console.log('[galzy-probe] longtask 统计（已停止观察）')
    console.table([
      { key: 'longtask count', value: String(longtaskCount) },
      { key: 'longtask 累计时长', value: `${longtaskTotalMs.toFixed(1)} ms` },
      { key: 'longtask 最大时长', value: `${longtaskMaxMs.toFixed(1)} ms` },
    ])
  } catch (error) {
    console.warn('[galzy-probe] stopCapabilityProbe 失败', error)
  }
}

declare global {
  interface Window {
    __galzyProbe?: {
      run: typeof runCapabilityProbe
      stop: typeof stopCapabilityProbe
    }
  }
}
