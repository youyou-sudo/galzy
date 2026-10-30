/**
 * 本机 Chromium 启动器（msedge / chrome），用于 UI 基线截图。
 *
 * 选择顺序：
 *   1. 环境变量 PARITY_BROWSER / CHROME_PATH / EDGE_PATH
 *   2. 常见安装路径（Chrome → Edge）
 *   3. Windows 上 from 'where' 的解析结果
 */
import { spawn, spawnSync, type Subprocess } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CdpClient, findPageTarget, waitForEndpoint } from './cdp'

const WINDOWS_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Chromium/Application/chrome.exe',
]

function fromWhere(name: string): string | null {
  try {
    const result = spawnSync('where', [name], { encoding: 'utf8' })
    const first = (result.stdout ?? '').split(/\r?\n/).map((line) => line.trim()).find(Boolean)
    return first ?? null
  } catch {
    return null
  }
}

/** 找到本机可用的 Chromium 可执行文件；找不到时抛错并提示如何指定。 */
export function findBrowser(explicit?: string): string {
  const candidates = [
    explicit,
    process.env.PARITY_BROWSER,
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    ...WINDOWS_CANDIDATES,
    fromWhere('chrome'),
    fromWhere('msedge'),
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter((value): value is string => Boolean(value))

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  throw new Error(
    '找不到 Chrome/Edge。请用 --browser <path> 或环境变量 PARITY_BROWSER 指定可执行文件。',
  )
}

/** 申请一个空闲的本地端口（用于 --remote-debugging-port）。 */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (typeof address === 'object' && address) {
        const port = address.port
        server.close(() => resolve(port))
      } else {
        server.close(() => reject(new Error('无法分配端口')))
      }
    })
  })
}

export type BrowserSession = {
  cdp: CdpClient
  port: number
  profileDir: string
  process: Subprocess
  close: () => Promise<void>
}

export type LaunchOptions = {
  browserPath?: string
  width: number
  height: number
  /** 是否以 headless 运行（默认 true） */
  headless?: boolean
  extraArgs?: string[]
  /** 保留 profile 目录（调试用） */
  keepProfile?: boolean
}

/**
 * 启动一个 headless Chromium 实例并连接它的首个 page target。
 * 每个 worker 一个实例，保证 route 之间互不污染（localStorage / 滚动 / 缓存）。
 */
export async function launchBrowser(options: LaunchOptions): Promise<BrowserSession> {
  const browserPath = findBrowser(options.browserPath)
  const headless = options.headless ?? true
  const port = await freePort()
  const profileDir = mkdtempSync(join(tmpdir(), 'galzy-parity-'))
  const args = [
    headless ? '--headless=new' : '--headless',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + profileDir,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-sync',
    '--disable-extensions',
    '--disable-default-apps',
    '--disable-features=Translate,TranslateUI,OptimizationHints,MediaRouter,InterestFeedContentSuggestions',
    '--mute-audio',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--font-render-hinting=none',
    '--disable-lcd-text',
    '--lang=zh-CN',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--metrics-recording-only',
    '--no-pings',
    '--window-size=' + options.width + ',' + options.height,
    ...(options.extraArgs ?? []),
    'about:blank',
  ]

  mkdirSync(profileDir, { recursive: true })
  const child = spawn(browserPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  let stderrText = ''
  child.stderr?.on('data', (chunk: Buffer) => {
    stderrText += chunk.toString('utf8')
    if (stderrText.length > 8000) stderrText = stderrText.slice(-8000)
  })
  let exited = false
  child.on('exit', () => {
    exited = true
  })

  // 等调试端口就绪
  const deadline = Date.now() + 30000
  let pageTarget: Awaited<ReturnType<typeof findPageTarget>> | null = null
  let lastError: unknown = null
  while (Date.now() < deadline) {
    if (exited) {
      throw new Error('浏览器进程提前退出：' + stderrText.slice(-1500))
    }
    try {
      pageTarget = await findPageTarget(port)
      break
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }
  if (!pageTarget) {
    try {
      child.kill()
    } catch {
      /* ignore */
    }
    throw new Error('浏览器调试端点未就绪: ' + String(lastError) + '\n' + stderrText.slice(-800))
  }

  const cdp = await CdpClient.connect(pageTarget.webSocketDebuggerUrl, 20000)

  const close = async () => {
    try {
      cdp.close()
    } catch {
      /* ignore */
    }
    try {
      if (process.platform === 'win32' && child.pid) {
        spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
      } else {
        child.kill('SIGKILL')
      }
    } catch {
      /* ignore */
    }
    if (!options.keepProfile) {
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          rmSync(profileDir, { recursive: true, force: true })
          break
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
      }
    }
  }

  return { cdp, port, profileDir, process: child, close }
}

/** 检查调试端点是否可达（--check 用）。 */
export async function probeBrowser(browserPath?: string): Promise<string> {
  const session = await launchBrowser({ browserPath, width: 800, height: 600 })
  try {
    const version = (await waitForEndpoint('http://127.0.0.1:' + session.port + '/json/version')) as {
      Browser?: string
    }
    return version.Browser ?? 'unknown'
  } finally {
    await session.close()
  }
}
