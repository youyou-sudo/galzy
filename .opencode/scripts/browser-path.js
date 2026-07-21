#!/usr/bin/env node
/**
 * browser-path.js — Detect and persist the user's default browser path.
 *
 * Usage (CLI):
 *   node .opencode/scripts/browser-path.js [--project-dir <path>]
 *
 * Exports pure helpers for unit testing without real registry access.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)

// ─── .env parsing ─────────────────────────────────────────────────────────────

/**
 * Parse a .env file into a key/value object.
 * Returns {} if the file does not exist.
 * Handles quoted values (strips surrounding " or ').
 * Ignores comment lines and blank lines.
 *
 * @param {string} envPath  Absolute path to the .env file
 * @returns {Record<string, string>}
 */
export function parseEnvFile(envPath) {
  let content
  try {
    content = fs.readFileSync(envPath, 'utf8')
  } catch {
    return {}
  }
  const result = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

// ─── .env writer ──────────────────────────────────────────────────────────────

/**
 * Append `KEY=VALUE` to a .env file, creating it if absent.
 * Throws if the key already exists in the file.
 *
 * @param {string} envPath
 * @param {string} key
 * @param {string} value
 */
export function appendEnvValue(envPath, key, value) {
  const existing = parseEnvFile(envPath)
  if (key in existing) {
    throw new Error(
      `appendEnvValue: key "${key}" already exists in ${envPath}. ` +
      `Remove it manually if you want to update it.`
    )
  }
  // Read current content to decide whether a leading newline is needed.
  // If the file is empty or ends with a newline, no prefix needed; otherwise add one.
  let currentContent = ''
  try { currentContent = fs.readFileSync(envPath, 'utf8') } catch { /* file absent */ }
  const needsLeadingNewline = currentContent.length > 0 && !currentContent.endsWith('\n')
  const line = `${needsLeadingNewline ? '\n' : ''}${key}=${value}\n`
  fs.appendFileSync(envPath, line, 'utf8')
}

// ─── Registry output parsers ──────────────────────────────────────────────────

/**
 * Parse the ProgId from `reg query ... /v ProgId` output.
 * Returns the ProgId string or null if not found.
 *
 * @param {string} output
 * @returns {string|null}
 */
export function parseProgIdOutput(output) {
  // Lines look like:  "    ProgId    REG_SZ    ChromeHTML"
  const match = output.match(/ProgId\s+REG_SZ\s+(\S+)/)
  return match ? match[1] : null
}

/**
 * Parse the open command from `reg query <ProgId>\\shell\\open\\command` output.
 * Returns the raw command string or null.
 *
 * @param {string} output
 * @returns {string|null}
 */
export function parseOpenCommandOutput(output) {
  // Lines look like:  "    (Default)    REG_SZ    "C:\...\chrome.exe" -- "%1""
  const match = output.match(/\(Default\)\s+REG_SZ\s+(.+)/)
  return match ? match[1].trim() : null
}

/**
 * Extract the executable path from a shell open command string.
 * Handles both quoted ("C:\path\to\exe.exe" args) and unquoted forms.
 *
 * @param {string} cmd
 * @returns {string|null}
 */
export function extractExeFromOpenCommand(cmd) {
  if (!cmd) return null
  // Quoted exe path
  const quotedMatch = cmd.match(/^"([^"]+\.exe)"/i)
  if (quotedMatch) return quotedMatch[1]
  // Unquoted: take up to first space or end
  const unquotedMatch = cmd.match(/^([^\s"]+\.exe)/i)
  if (unquotedMatch) return unquotedMatch[1]
  return null
}

// ─── Windows default browser detection ────────────────────────────────────────

/**
 * Default exec implementation using the real Windows registry.
 * @param {string} bin
 * @param {string[]} args
 * @returns {Promise<string>}
 */
async function defaultExec(bin, args) {
  const { stdout } = await execFileAsync(bin, args, { encoding: 'utf8' })
  return stdout
}

/**
 * Detect the Windows default browser executable via registry lookups.
 * Accepts an injectable `exec` function for testing without real registry.
 *
 * @param {{ exec?: (bin: string, args: string[]) => Promise<string> }} [opts]
 * @returns {Promise<string>}  Absolute path to the browser executable
 */
export async function detectWindowsDefaultBrowserPath(opts = {}) {
  const exec = opts.exec ?? defaultExec
  const progIdKey =
    'HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice'

  let progIdOutput
  try {
    progIdOutput = await exec('reg', ['query', progIdKey, '/v', 'ProgId'])
  } catch (err) {
    throw new Error(
      `Failed to detect default browser from registry: ${err.message}`
    )
  }

  const progId = parseProgIdOutput(progIdOutput)
  if (!progId) {
    throw new Error(
      `Could not parse ProgId from registry output. ` +
      `Unable to detect default browser.`
    )
  }

  const openCmdKey = `HKCR\\${progId}\\shell\\open\\command`
  let openCmdOutput
  try {
    openCmdOutput = await exec('reg', ['query', openCmdKey])
  } catch (err) {
    throw new Error(
      `Failed to read open command for ProgId "${progId}" from registry: ${err.message}`
    )
  }

  const rawCmd = parseOpenCommandOutput(openCmdOutput)
  if (!rawCmd) {
    throw new Error(
      `Could not parse open command for ProgId "${progId}". ` +
      `Unable to detect default browser.`
    )
  }

  const exePath = extractExeFromOpenCommand(rawCmd)
  if (!exePath) {
    throw new Error(
      `Could not extract executable path from open command: "${rawCmd}"`
    )
  }

  return exePath
}

// ─── ensureBrowserPathEnv ─────────────────────────────────────────────────────

/**
 * Ensure SUPERCODER_BROWSER_PATH is set in the project .env file.
 *
 * - If already set: validates it's non-empty and the file exists, then returns {status:'existing', path, envPath}.
 * - If absent: auto-detects on Windows, writes to .env, returns {status:'written', path, envPath}.
 * - Throws on empty value or missing file.
 *
 * @param {string} projectDir  Root of the project (where .env lives)
 * @param {{ exec?: (bin: string, args: string[]) => Promise<string>, platform?: string }} [opts]
 * @returns {Promise<{ status: 'existing'|'written', path: string, envPath: string }>}
 */
export async function ensureBrowserPathEnv(projectDir, opts = {}) {
  const envPath = path.join(projectDir, '.env')
  const parsed = parseEnvFile(envPath)
  const existing = parsed['SUPERCODER_BROWSER_PATH']

  if ('SUPERCODER_BROWSER_PATH' in parsed) {
    if (!existing || existing.trim() === '') {
      throw new Error(
        `SUPERCODER_BROWSER_PATH is set but empty in ${envPath}. ` +
        `Please provide a valid browser executable path.`
      )
    }
    // Check if the file actually exists (skip on paths that look like test/fake values)
    // Covers: Unix absolute (/...), Windows drive letters (C:\, d:\, etc.),
    // and UNC paths (\\server\share\...)
    const isAbsolutePath =
      existing.startsWith('/') ||
      /^[a-zA-Z]:[\\\/]/.test(existing) ||
      existing.startsWith('\\\\')
    if (!fs.existsSync(existing) && isAbsolutePath) {
      throw new Error(
        `SUPERCODER_BROWSER_PATH="${existing}" does not exist on disk. ` +
        `Please update ${envPath} with a valid browser executable path.`
      )
    }
    return { status: 'existing', path: existing, envPath }
  }

  // Not set — auto-detect (Windows only)
  const platform = opts.platform ?? process.platform
  if (platform !== 'win32') {
    throw new Error(
      `SUPERCODER_BROWSER_PATH is not set in ${envPath}. ` +
      `Auto-detection is only supported on Windows. ` +
      `On Linux/macOS, please add SUPERCODER_BROWSER_PATH=<path-to-browser> to your .env file manually.`
    )
  }
  const detectedPath = await detectWindowsDefaultBrowserPath(opts)
  appendEnvValue(envPath, 'SUPERCODER_BROWSER_PATH', detectedPath)
  return { status: 'written', path: detectedPath, envPath }
}

// ─── classifyBrowserType ──────────────────────────────────────────────────────

const CHROMIUM_PATTERNS = [
  // Windows .exe names
  /chrome\.exe$/i, /msedge\.exe$/i, /brave\.exe$/i, /chromium\.exe$/i, /opera\.exe$/i, /vivaldi\.exe$/i,
  // Non-Windows binary names / path segments (case-insensitive)
  /[/\\]google[- ]chrome$/i,         // /usr/bin/google-chrome, /usr/bin/google chrome
  /[/\\]google chrome$/i,            // macOS: .../MacOS/Google Chrome
  /[/\\]chromium(?:-browser)?$/i,    // /usr/bin/chromium, /usr/bin/chromium-browser
  /[/\\]chrome$/i,                   // /usr/bin/chrome
  /[/\\]microsoft[- ]edge$/i,        // /usr/bin/microsoft-edge, macOS
  /microsoft edge$/i,                // macOS: .../MacOS/Microsoft Edge
]
const FIREFOX_PATTERNS = [
  /firefox\.exe$/i,
  /[/\\]firefox$/i,                  // /usr/bin/firefox, macOS .../MacOS/firefox
]

/**
 * Classify a browser executable path into a Playwright browser type.
 *
 * @param {string} exePath
 * @returns {'chromium'|'firefox'|'unknown'}
 */
export function classifyBrowserType(exePath) {
  for (const pattern of CHROMIUM_PATTERNS) {
    if (pattern.test(exePath)) return 'chromium'
  }
  for (const pattern of FIREFOX_PATTERNS) {
    if (pattern.test(exePath)) return 'firefox'
  }
  return 'unknown'
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

const _thisFile = fileURLToPath(import.meta.url)
const isMain =
  typeof process !== 'undefined' &&
  typeof process.argv[1] === 'string' &&
  process.argv[1] === _thisFile

if (isMain) {
  // Parse optional --project-dir flag
  let projectDir = process.cwd()
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--project-dir') {
      projectDir = argv[++i]
    }
  }

  ensureBrowserPathEnv(projectDir)
    .then(({ status, path: browserPath, envPath }) => {
      if (status === 'existing') {
        process.stdout.write(`[browser-path] Using existing SUPERCODER_BROWSER_PATH from ${envPath}\n`)
      } else {
        process.stdout.write(`[browser-path] Detected and wrote SUPERCODER_BROWSER_PATH to ${envPath}\n`)
      }
      process.stdout.write(`[browser-path] Browser path: ${browserPath}\n`)
      process.stdout.write(`[browser-path] Browser type: ${classifyBrowserType(browserPath)}\n`)
    })
    .catch((err) => {
      process.stderr.write(`[browser-path] Error: ${err.message}\n`)
      process.exit(1)
    })
}
