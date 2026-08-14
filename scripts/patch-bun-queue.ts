/**
 * Patch @stacksjs/bun-queue for `bun build --compile` single-binary builds.
 *
 * Problem:
 *   bun-queue's Queue.init() loads its Lua command scripts from
 *   `${import.meta.dir}/commands`. When bundled into a standalone executable
 *   (bun build --compile), `import.meta.dir` becomes the virtual `/$bunfs/root`
 *   and the .lua files are NOT embedded, so readdir throws ENOENT. The first
 *   queue fails to initialize and every script-dependent operation (worker
 *   processing, stalled checker, distributed lock) breaks afterwards.
 *
 * Fix:
 *   1. Rewrite the script directory to `${process.cwd()}/commands` — a real
 *      filesystem path that exists in both dev (`apps/api/commands`, copied
 *      here) and production (`/app/commands`, copied by the Dockerfile).
 *   2. Copy `dist/commands` → `apps/api/commands` so dev (`bun run dev`, cwd =
 *      apps/api) finds the scripts too.
 *
 * Runs as the `postinstall` hook of apps/api, so it re-applies on every
 * install and stays idempotent.
 */
import { cpSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(
  root,
  'apps',
  'api',
  'node_modules',
  '@stacksjs',
  'bun-queue',
  'dist',
)
const distFile = join(distDir, 'index.js')
const commandsDir = join(distDir, 'commands')
const apiCommandsDir = join(root, 'apps', 'api', 'commands')

// ── 1. Patch the script directory expression ──────────────────
const target = '${import.meta.dir}/commands'
const replacement = '${process.cwd()}/commands'

if (!existsSync(distFile)) {
  console.warn('[patch-bun-queue] dist/index.js not found, skipping patch.')
} else {
  const src = readFileSync(distFile, 'utf8')
  if (!src.includes(target)) {
    console.warn(
      '[patch-bun-queue] target string not found (lib may have changed); skipping patch.',
    )
  } else {
    const patched = src.replaceAll(target, replacement)
    writeFileSync(distFile, patched)
    console.log('[patch-bun-queue] patched commands path → process.cwd()/commands')
  }
}

// ── 2. Copy commands for dev (cwd = apps/api) ─────────────────
if (existsSync(commandsDir)) {
  if (!existsSync(apiCommandsDir)) {
    mkdirSync(apiCommandsDir, { recursive: true })
    cpSync(commandsDir, apiCommandsDir, { recursive: true })
    console.log('[patch-bun-queue] copied commands → apps/api/commands')
  } else {
    console.log('[patch-bun-queue] apps/api/commands already exists, skipped copy.')
  }
} else {
  console.warn('[patch-bun-queue] source commands dir not found, skipped copy.')
}
