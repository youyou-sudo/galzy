#!/usr/bin/env node
/**
 * browse.js — ESM CLI helper for the @爬虫工程师 feature.
 *
 * Usage:
 *   node .opencode/scripts/browse.js --url <url> [--mode aria|text]
 *     [--timeout <ms>] [--settle <ms>] [--max-lines <n>] [--max-chars <n>]
 *     [--wait-until domcontentloaded|networkidle|load|commit]
 *     [--ignore-http-errors] [--cdp] [--cdp-url <url>] [--human-timeout <s>]
 *
 * Treats `patchright` as an optional local runtime dependency: if not found,
 * prints a friendly install message and exits non-zero.
 */
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { spawn } from 'node:child_process'
import { classifyBrowserType, ensureBrowserPathEnv } from './browser-path.js'

// ─── Project root resolution ──────────────────────────────────────────────────

/**
 * Resolve the project root directory deterministically from this script's location.
 * browse.js lives at <project-root>/.opencode/scripts/browse.js, so the project
 * root is two levels up from __dirname — never from process.cwd().
 *
 * @returns {string} Absolute path to the project root
 */
export function resolveProjectDir() {
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  return resolve(scriptDir, '../..')
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_MODE = 'aria'
const DEFAULT_TIMEOUT = 30000
const DEFAULT_SETTLE = 500
const DEFAULT_MAX_LINES = 500
const DEFAULT_MAX_CHARS = 20000
const DEFAULT_WAIT_UNTIL = 'domcontentloaded'
const VALID_WAIT_UNTIL_VALUES = ['domcontentloaded', 'networkidle', 'load', 'commit']
const DEFAULT_CDP_URL = 'http://localhost:9222'
const DEFAULT_HUMAN_TIMEOUT = 120 // seconds

// ─── Argument parsing ─────────────────────────────────────────────────────────

/**
 * Parse CLI argv array (process.argv.slice(2)) into an options object.
 * Throws an Error with a human-readable message on invalid input.
 *
 * @param {string[]} argv
 * @returns {{
 *   url: string,
 *   mode: 'aria'|'text',
 *   timeout: number,
 *   settle: number,
 *   maxLines: number,
 *   maxChars: number,
 * }}
 */
/**
 * Parse a numeric CLI flag value; throws a clear error if NaN.
 * @param {string} value  raw string from argv
 * @param {string} flagName  e.g. '--timeout'
 * @returns {number}
 */
function parseNumericFlag(value, flagName) {
  const n = Number(value)
  if (Number.isNaN(n)) {
    throw new Error(`Invalid ${flagName} value: "${value}" is not a valid number`)
  }
  return n
}

export function parseArgs(argv) {
  const raw = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--url') raw.url = argv[++i]
    else if (arg === '--mode') raw.mode = argv[++i]
    else if (arg === '--timeout') raw.timeout = argv[++i]
    else if (arg === '--settle') raw.settle = argv[++i]
    else if (arg === '--max-lines') raw.maxLines = argv[++i]
    else if (arg === '--max-chars') raw.maxChars = argv[++i]
    else if (arg === '--wait-until') raw.waitUntil = argv[++i]
    else if (arg === '--ignore-http-errors') raw.ignoreHttpErrors = true
    else if (arg === '--cdp') raw.cdp = true
    else if (arg === '--cdp-url') raw.cdpUrl = argv[++i]
    else if (arg === '--human-timeout') raw.humanTimeout = argv[++i]
    else if (arg === '--auto-fallback') raw.autoFallback = true
    // Unknown flags are silently ignored for forward-compat
  }

  // Validate --url
  if (!raw.url) {
    throw new Error('Missing required argument: --url <url>')
  }
  try {
    new URL(raw.url) // eslint-disable-line no-new
  } catch {
    throw new Error(`Invalid --url value: "${raw.url}" is not a valid URL`)
  }

  // Validate --mode
  const mode = raw.mode ?? DEFAULT_MODE
  if (mode !== 'aria' && mode !== 'text') {
    throw new Error(`Invalid --mode value: "${mode}". Must be "aria" or "text"`)
  }

  // Validate --wait-until
  const waitUntil = raw.waitUntil ?? DEFAULT_WAIT_UNTIL
  if (!VALID_WAIT_UNTIL_VALUES.includes(waitUntil)) {
    throw new Error(`Invalid --wait-until value: "${waitUntil}". Must be one of: ${VALID_WAIT_UNTIL_VALUES.join('|')}`)
  }

  return {
    url: raw.url,
    mode,
    timeout: raw.timeout !== undefined ? parseNumericFlag(raw.timeout, '--timeout') : DEFAULT_TIMEOUT,
    settle: raw.settle !== undefined ? parseNumericFlag(raw.settle, '--settle') : DEFAULT_SETTLE,
    maxLines: raw.maxLines !== undefined ? parseNumericFlag(raw.maxLines, '--max-lines') : DEFAULT_MAX_LINES,
    maxChars: raw.maxChars !== undefined ? parseNumericFlag(raw.maxChars, '--max-chars') : DEFAULT_MAX_CHARS,
    waitUntil,
    ignoreHttpErrors: raw.ignoreHttpErrors ?? false,
    cdp: raw.cdp ?? false,
    cdpUrl: raw.cdpUrl ?? DEFAULT_CDP_URL,
    humanTimeout: raw.humanTimeout !== undefined ? parseNumericFlag(raw.humanTimeout, '--human-timeout') : DEFAULT_HUMAN_TIMEOUT,
    autoFallback: raw.autoFallback ?? false,
  }
}

// ─── Truncation ───────────────────────────────────────────────────────────────

/**
 * Deterministically truncate text by character count and/or line count.
 *
 * @param {string} text
 * @param {{ maxChars?: number, maxLines?: number }} [opts]
 * @returns {{ text: string, truncated: boolean }}
 */
export function truncateText(text, opts = {}) {
  const maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS
  const maxLines = opts.maxLines ?? DEFAULT_MAX_LINES

  let result = text
  let truncated = false

  // Clip by line count first (preserves line-based structure)
  const lines = result.split('\n')
  if (lines.length > maxLines) {
    result = lines.slice(0, maxLines).join('\n')
    truncated = true
  }

  // Clip by char count — hard ceiling: notice must fit within maxChars
  if (result.length > maxChars) {
    const notice = '\n[truncated — output exceeded limits]'
    // Reserve space for notice so the final string is <= maxChars
    const budget = maxChars - notice.length
    result = result.slice(0, Math.max(0, budget)) + notice
    truncated = true
  } else if (truncated) {
    // Truncated by lines only — append notice (may push past maxChars but line-limit was the trigger)
    result += `\n[truncated — output exceeded limits (maxLines=${maxLines})]`
  }

  return { text: result, truncated }
}

// ─── Output builder ───────────────────────────────────────────────────────────

/**
 * Build a JSON-serialisable result object for stdout.
 *
 * @param {{
 *   url: string,
 *   title: string,
 *   mode: 'aria'|'text',
 *   content: string,
 *   truncated: boolean,
 * }} params
 */
export function buildOutput({ url, title, mode, content, truncated }) {
  return { url, title, mode, content, truncated }
}

// ─── Dependency error helpers ─────────────────────────────────────────────────

/** @returns {Error} */
export function makePlaywrightMissingError() {
  return new Error(
    'Patchright is not installed in this project.\n' +
      'To use @爬虫工程师, install patchright locally:\n' +
      '  npm install patchright\n' +
      'If you are not using a system browser (SUPERCODER_BROWSER_PATH), also install Chromium:\n' +
      '  npx patchright install chromium\n' +
      'Note: @爬虫工程师 also requires a browser executable to be configured via\n' +
      'SUPERCODER_BROWSER_PATH or auto-detected from your system.\n' +
      '(Do NOT add patchright as a dependency of the supercoder package itself.)'
  )
}

/** @returns {Error} */
export function makeAriaUnavailableError() {
  return new Error(
    'page.ariaSnapshot({ mode: "ai" }) is not available.\n' +
      'This requires Patchright >= 1.50. Please upgrade your local patchright:\n' +
      '  npm install patchright@latest'
  )
}

// ─── HTTP response classification ────────────────────────────────────────────

/**
 * Classify an HTTP response status as ok or failure.
 * Only explicit 4xx/5xx statuses are treated as failures.
 * A null status (non-HTTP navigations such as file://) is treated as ok.
 *
 * @param {number|null} status  HTTP status code, or null for non-HTTP navigations
 * @returns {{ ok: boolean, message?: string }}
 */
export function classifyHttpResponse(status) {
  if (status === null || status === undefined) {
    return { ok: true }
  }
  if (status >= 400) {
    return { ok: false, message: `HTTP error: server responded with status ${status}` }
  }
  return { ok: true }
}

// ─── CAPTCHA detection ────────────────────────────────────────────────────────

/**
 * Detect if a page appears to be showing a CAPTCHA or bot-verification challenge.
 * Pure function — checks title and URL against known patterns.
 *
 * @param {string} title  Page title
 * @param {string} url    Current page URL
 * @returns {boolean}
 */
export function detectCaptcha(title, url) {
  const patterns = [
    /captcha/i,
    /robot/i,
    /security.?check/i,
    /safety.?check/i,
    /verify.*human/i,
    /human.*verify/i,
    /challenge/i,
    /人机验证/,
    /安全验证/,
    /验证/,
    /请证明你是人/,
  ]
  return patterns.some(p => p.test(title) || p.test(url))
}

/**
 * Wait for a CAPTCHA/bot-verification challenge to be resolved by the human user.
 * Polls the page every 2 seconds until the challenge disappears or timeout is reached.
 * Writes status messages to stderr.
 *
 * @param {import('playwright').Page} page
 * @param {number} humanTimeout  Maximum seconds to wait
 * @param {{ write: (s: string) => void }} stderr  Where to write status messages
 * @returns {Promise<void>} Resolves when CAPTCHA is gone; throws on timeout
 */
export async function waitForCaptchaResolution(page, humanTimeout, stderr) {
  const endTime = Date.now() + humanTimeout * 1000
  stderr.write(`[browse] CAPTCHA/verification detected! Please solve it in your browser.\n`)
  stderr.write(`[browse] Waiting up to ${humanTimeout} seconds for resolution...\n`)

  while (Date.now() < endTime) {
    await page.waitForTimeout(2000)
    const title = await page.title()
    const url = page.url()
    if (!detectCaptcha(title, url)) {
      stderr.write('[browse] Verification resolved, continuing...\n')
      return
    }
  }
  throw new Error(
    `CAPTCHA/verification was not resolved within ${humanTimeout} seconds.\n` +
    `Please solve the challenge in your browser and retry.`
  )
}

// ─── Text extraction (text mode) ─────────────────────────────────────────────

/**
 * Extract visible text from a Playwright page object using innerText.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<string>}
 */
async function extractText(page) {
  // Pragmatic fallback: get body innerText (always available)
  try {
    return await page.evaluate(() => document.body?.innerText ?? '')
  } catch {
    return ''
  }
}

// ─── Browser launch target resolution ────────────────────────────────────────

/**
 * Given a browser executable path, return the Playwright browser type and executablePath.
 * Throws clearly if the browser family is not supported.
 *
 * @param {string} exePath  Absolute path to browser executable
 * @returns {{ browserType: 'chromium'|'firefox', executablePath: string }}
 */
export function resolveLaunchTarget(exePath) {
  const browserType = classifyBrowserType(exePath)
  if (browserType === 'unknown') {
    throw new Error(
      `Cannot launch browser: unsupported or unknown browser executable "${exePath}". ` +
      `Supported families: Chromium-based (chrome, edge, brave, vivaldi, opera) and Firefox.`
    )
  }
  return { browserType, executablePath: exePath }
}

// ─── CDP auto-start helpers ───────────────────────────────────────────────────

/**
 * Check if a browser process is currently running by executable name.
 * @param {string} browserName  e.g. "msedge.exe" or "chrome.exe"
 * @returns {boolean}
 */
export function isBrowserRunning(browserName) {
  try {
    const output = execSync(`tasklist /FI "IMAGENAME eq ${browserName}" /NH`, { encoding: 'utf8' })
    return output.includes(browserName)
  } catch { return false }
}

/**
 * Get the default user profile directory for a known browser on Windows.
 * @param {string} browserPath  Absolute path to browser executable
 * @returns {string|null}
 */
export function getDefaultProfileDir(browserPath) {
  const localAppData = process.env.LOCALAPPDATA
  if (!localAppData) return null
  const browserType = classifyBrowserType(browserPath)
  if (browserType === 'chromium') {
    if (/msedge/i.test(browserPath)) return path.join(localAppData, 'Microsoft', 'Edge', 'User Data')
    if (/chrome/i.test(browserPath)) return path.join(localAppData, 'Google', 'Chrome', 'User Data')
    if (/brave/i.test(browserPath)) return path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data')
  }
  return null
}

/**
 * Launch a browser with CDP enabled, detached from the current process.
 * @param {string} browserPath
 * @param {number} port
 * @param {string|null} profileDir
 */
function launchBrowserWithCdp(browserPath, port, profileDir) {
  const args = [`--remote-debugging-port=${port}`]
  if (profileDir) args.push(`--user-data-dir=${profileDir}`)
  const child = spawn(browserPath, args, { detached: true, stdio: 'ignore' })
  child.unref()
  return child
}

/**
 * Poll CDP endpoint until it responds or timeout expires.
 * @param {number} port
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>}
 */
async function waitForCdpPort(port, timeoutMs = 10000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${port}/json/version`)
      if (res.ok) return true
    } catch {}
    await new Promise(r => setTimeout(r, 500))
  }
  return false
}

/**
 * Auto-start a browser with CDP if not already running, then connect.
 *
 * @param {{
 *   port: number,
 *   projectDir: string,
 *   _browserPathResolver?: (dir: string) => Promise<{ path: string }>,
 *   _processChecker?: (name: string) => boolean,
 *   _browserLauncher?: (browserPath: string, port: number, profileDir: string|null) => void,
 *   _stderr?: { write: (s: string) => void },
 *   _cdpConnector?: (url: string) => Promise<object>,
 * }} opts
 * @returns {Promise<{ browser: object, context: object }>}
 */
export async function autoStartCdpBrowser(opts) {
  const {
    port,
    projectDir,
    _browserPathResolver,
    _processChecker = isBrowserRunning,
    _browserLauncher = launchBrowserWithCdp,
    _waitForPort = waitForCdpPort,
    _stderr,
    _cdpConnector,
  } = opts

  const stderr = _stderr ?? process.stderr

  const browserPathResolver = _browserPathResolver ?? ((dir) => ensureBrowserPathEnv(dir))
  const { path: browserPath } = await browserPathResolver(projectDir)

  // Extract executable name from path (e.g. msedge.exe)
  const browserExeName = path.basename(browserPath)

  const alreadyRunning = _processChecker(browserExeName)

  if (alreadyRunning) {
    // Browser is running but CDP not reachable
    const err = new Error(
      `浏览器已在运行（${browserExeName}）但 CDP 端口 ${port} 不可达。\n` +
      `请关闭浏览器后重试，或手动启用 CDP（参考 enable-edge-cdp.ps1）。`
    )
    throw err
  }

  // Browser not running — launch it with CDP enabled
  const profileDir = getDefaultProfileDir(browserPath)
  _browserLauncher(browserPath, port, profileDir)

  stderr.write(`[browse] 自动启动浏览器 (CDP port ${port})\n`)

  const ready = await _waitForPort(port)
  if (!ready) {
    throw new Error(`自动启动浏览器后等待 CDP 端口 ${port} 超时（10 秒）。`)
  }

  const cdpUrl = `http://localhost:${port}`
  const connector = _cdpConnector ?? ((url) => { throw new Error(`_cdpConnector required, called with ${url}`) })
  const browser = await connector(cdpUrl)
  const existingContexts = browser.contexts()
  const context = existingContexts.length > 0 ? existingContexts[0] : await browser.newContext()

  return { browser, context }
}

// ─── Main browse runner ───────────────────────────────────────────────────────

/**
 * Close the given headless browser and establish a CDP connection.
 * Re-uses the same CDP connection / auto-start logic as the regular CDP path in browse().
 *
 * @param {object} opts  Full opts object passed to browse()
 * @param {object} headlessBrowser  The headless browser instance to close first
 * @param {{ write: (s: string) => void }} stderr
 * @param {object} playwright  Already-loaded playwright module
 * @returns {Promise<{ browser: object, context: object }>}
 */
export async function fallbackToCdp(opts, headlessBrowser, stderr, playwright) {
  await headlessBrowser.close()

  const cdpUrl = opts.cdpUrl ?? DEFAULT_CDP_URL
  const cdpPort = (() => {
    try { return new URL(cdpUrl).port ? Number(new URL(cdpUrl).port) : 9222 } catch { return 9222 }
  })()
  const cdpConnector = opts._cdpConnector ?? ((url) => playwright.chromium.connectOverCDP(url))

  let browser
  let connected = false
  try {
    browser = await cdpConnector(cdpUrl)
    connected = true
  } catch {
    // Connection failed — try auto-start
  }

  let context
  if (connected) {
    const existingContexts = browser.contexts()
    context = existingContexts.length > 0 ? existingContexts[0] : await browser.newContext()
  } else {
    const projectDir = opts.projectDir ?? resolveProjectDir()
    const result = await autoStartCdpBrowser({
      port: cdpPort,
      projectDir,
      _browserPathResolver: opts._browserPathResolver,
      _processChecker: opts._processChecker,
      _browserLauncher: opts._browserLauncher,
      _waitForPort: opts._waitForPort,
      _stderr: stderr,
      _cdpConnector: cdpConnector,
    })
    browser = result.browser
    context = result.context
  }

  return { browser, context }
}

/**
 * Core browse logic. Exported for testability; also called by CLI entry point.
 *
 * @param {{
 *   url: string,
 *   mode: 'aria'|'text',
 *   timeout: number,
 *   settle: number,
 *   maxLines: number,
 *   maxChars: number,
 *   waitUntil?: string,
 *   ignoreHttpErrors?: boolean,
 *   cdp?: boolean,
 *   cdpUrl?: string,
 *   humanTimeout?: number,
 *   autoFallback?: boolean,
 *   _stderr?: { write: (s: string) => void },
 *   _cdpConnector?: (url: string) => Promise<object>,
 *   _processChecker?: (name: string) => boolean,
 *   _browserLauncher?: (browserPath: string, port: number, profileDir: string|null) => void,
 *   projectDir?: string,
 *   _browserPathResolver?: (projectDir: string) => Promise<{ path: string }>,
 *   _playwrightLoader?: () => Promise<object>,
 *   _stdout?: { write: (s: string) => void },
 * }} opts
 * `_browserPathResolver`, `_playwrightLoader`, `_stdout`, `_stderr`, and `_cdpConnector`
 * are test-only injection points (underscore prefix signals internal/test use).
 * Normal callers should omit them.
 * @returns {Promise<object>} The structured output object (also written to stdout)
 */
async function runPageLoad({ opts, browser, context, stdout, stderr, playwright, isCdp }) {
  const page = await context.newPage()
  try {
    const response = await page.goto(opts.url, { timeout: opts.timeout, waitUntil: opts.waitUntil ?? DEFAULT_WAIT_UNTIL })

    const httpStatus = response ? response.status() : null
    const httpCheck = classifyHttpResponse(httpStatus)
    if (!httpCheck.ok && !opts.ignoreHttpErrors) {
      throw new Error(httpCheck.message)
    }

    if (opts.settle > 0) {
      await page.waitForTimeout(opts.settle)
    }

    // ── CAPTCHA / human-assistance check ──────────────────────────────────────
    const titleAfterSettle = await page.title()
    const urlAfterSettle = page.url()
    if (detectCaptcha(titleAfterSettle, urlAfterSettle)) {
      await waitForCaptchaResolution(page, opts.humanTimeout ?? DEFAULT_HUMAN_TIMEOUT, stderr)
      // Brief pause after resolution to let the page finish redirecting
      if (opts.settle > 0) {
        await page.waitForTimeout(Math.min(opts.settle, 1000))
      }
    }

    const title = await page.title()
    let rawContent

    if (opts.mode === 'aria') {
      if (typeof page.ariaSnapshot !== 'function') {
        throw makeAriaUnavailableError()
      }
      try {
        rawContent = await page.ariaSnapshot({ mode: 'ai' })
      } catch (err) {
        if (/mode/i.test(String(err))) {
          throw makeAriaUnavailableError()
        }
        throw err
      }
    } else {
      rawContent = await extractText(page)
    }

    const { text: content, truncated } = truncateText(rawContent, {
      maxChars: opts.maxChars,
      maxLines: opts.maxLines,
    })

    const output = buildOutput({ url: opts.url, title, mode: opts.mode, content, truncated })
    stdout.write(JSON.stringify(output, null, 2) + '\n')
    return output
  } finally {
    await page.close()
    await browser.close()
  }
}

export async function browse(opts) {
  // Dynamic import so missing patchright gives a friendly error
  const playwrightLoader = opts._playwrightLoader ?? (async () => {
    try {
      return await import('patchright')
    } catch {
      throw makePlaywrightMissingError()
    }
  })
  const playwright = await playwrightLoader()

  const stdout = opts._stdout ?? process.stdout
  const stderr = opts._stderr ?? process.stderr

  let browser
  let context

  if (opts.cdp) {
    // ── CDP mode: connect to an already-running browser, or auto-start one ───
    const cdpUrl = opts.cdpUrl ?? DEFAULT_CDP_URL
    const cdpPort = (() => {
      try { return new URL(cdpUrl).port ? Number(new URL(cdpUrl).port) : 9222 } catch { return 9222 }
    })()
    const cdpConnector = opts._cdpConnector ?? ((url) => playwright.chromium.connectOverCDP(url))

    let connected = false
    try {
      browser = await cdpConnector(cdpUrl)
      connected = true
    } catch {
      // Connection failed — try auto-start
    }

    if (connected) {
      const existingContexts = browser.contexts()
      context = existingContexts.length > 0 ? existingContexts[0] : await browser.newContext()
    } else {
      const projectDir = opts.projectDir ?? resolveProjectDir()
      const result = await autoStartCdpBrowser({
        port: cdpPort,
        projectDir,
        _browserPathResolver: opts._browserPathResolver,
        _processChecker: opts._processChecker,
        _browserLauncher: opts._browserLauncher,
        _waitForPort: opts._waitForPort,
        _stderr: stderr,
        _cdpConnector: cdpConnector,
      })
      browser = result.browser
      context = result.context
    }
  } else {
    // ── Normal mode: launch a new headless browser ────────────────────────────
    const projectDir = opts.projectDir ?? resolveProjectDir()
    const browserPathResolver = opts._browserPathResolver ?? ((dir) => ensureBrowserPathEnv(dir))
    const { path: exePath } = await browserPathResolver(projectDir)
    const { browserType, executablePath } = resolveLaunchTarget(exePath)

    let browserLauncher
    let launchOpts
    if (browserType === 'firefox') {
      // Patchright does not support Firefox — fall back to Patchright-managed Chromium
      stderr.write('[browse] Firefox not supported by Patchright, falling back to Patchright-managed Chromium\n')
      browserLauncher = playwright.chromium
      launchOpts = { headless: true, args: ['--disable-blink-features=AutomationControlled'] }
    } else {
      browserLauncher = playwright.chromium
      launchOpts = { headless: true, executablePath, args: ['--disable-blink-features=AutomationControlled'] }
    }
    browser = await browserLauncher.launch(launchOpts)
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
    })
  }

  const page = await context.newPage()
  try {
    const response = await page.goto(opts.url, { timeout: opts.timeout, waitUntil: opts.waitUntil ?? DEFAULT_WAIT_UNTIL })

    const httpStatus = response ? response.status() : null
    const httpCheck = classifyHttpResponse(httpStatus)

    // Auto-fallback: on blocking HTTP status codes, switch to CDP mode
    if (!httpCheck.ok && !opts.ignoreHttpErrors && opts.autoFallback && !opts.cdp) {
      const blockingStatuses = [401, 403, 407]
      if (blockingStatuses.includes(httpStatus)) {
        await page.close()
        stderr.write('[browse] Headless blocked, falling back to CDP mode...\n')
        const { browser: cdpBrowser, context: cdpContext } = await fallbackToCdp(opts, browser, stderr, playwright)
        browser = cdpBrowser
        context = cdpContext
        return await runPageLoad({ opts, browser, context, stdout, stderr, playwright, isCdp: true })
      }
    }

    if (!httpCheck.ok && !opts.ignoreHttpErrors) {
      throw new Error(httpCheck.message)
    }

    if (opts.settle > 0) {
      await page.waitForTimeout(opts.settle)
    }

    // ── CAPTCHA / human-assistance check ──────────────────────────────────────
    const titleAfterSettle = await page.title()
    const urlAfterSettle = page.url()
    if (detectCaptcha(titleAfterSettle, urlAfterSettle)) {
      // Auto-fallback: switch to CDP mode for human to solve CAPTCHA
      if (opts.autoFallback && !opts.cdp) {
        await page.close()
        stderr.write('[browse] Headless blocked, falling back to CDP mode...\n')
        const { browser: cdpBrowser, context: cdpContext } = await fallbackToCdp(opts, browser, stderr, playwright)
        browser = cdpBrowser
        context = cdpContext
        return await runPageLoad({ opts, browser, context, stdout, stderr, playwright, isCdp: true })
      }
      await waitForCaptchaResolution(page, opts.humanTimeout ?? DEFAULT_HUMAN_TIMEOUT, stderr)
      // Brief pause after resolution to let the page finish redirecting
      if (opts.settle > 0) {
        await page.waitForTimeout(Math.min(opts.settle, 1000))
      }
    }

    const title = await page.title()
    let rawContent

    if (opts.mode === 'aria') {
      if (typeof page.ariaSnapshot !== 'function') {
        throw makeAriaUnavailableError()
      }
      try {
        rawContent = await page.ariaSnapshot({ mode: 'ai' })
      } catch (err) {
        if (/mode/i.test(String(err))) {
          throw makeAriaUnavailableError()
        }
        throw err
      }
    } else {
      rawContent = await extractText(page)
    }

    const { text: content, truncated } = truncateText(rawContent, {
      maxChars: opts.maxChars,
      maxLines: opts.maxLines,
    })

    const output = buildOutput({ url: opts.url, title, mode: opts.mode, content, truncated })
    stdout.write(JSON.stringify(output, null, 2) + '\n')
    return output
  } finally {
    await page.close()
    // For CDP connections: browser.close() disconnects without closing the real browser.
    // For launched browsers: browser.close() terminates the process.
    await browser.close()
  }
}

// ESM-safe main detection: resolve this file's path and compare to argv[1]
const _thisFile = fileURLToPath(import.meta.url)
const isMain =
  typeof process !== 'undefined' &&
  typeof process.argv[1] === 'string' &&
  process.argv[1] === _thisFile

if (isMain) {
  let opts
  try {
    opts = parseArgs(process.argv.slice(2))
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`)
    process.stderr.write(
      'Usage: node .opencode/scripts/browse.js --url <url> [--mode aria|text]\n' +
      '  [--timeout <ms>] [--settle <ms>] [--max-lines <n>] [--max-chars <n>]\n' +
      '  [--wait-until domcontentloaded|networkidle|load|commit]\n' +
      '  [--ignore-http-errors] [--cdp] [--cdp-url <url>] [--human-timeout <s>]\n'
    )
    process.exit(1)
  }

  browse(opts).catch((err) => {
    process.stderr.write(`Error: ${err.message}\n`)
    process.exit(1)
  })
}
