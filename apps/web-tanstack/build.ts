/**
 * build.ts — Compile the production server + embedded static assets
 * into a standalone Bun executable.
 *
 * Strategy:
 *   1. Scan dist/ and create a single binary blob (dist-blob.data)
 *      containing ALL files with their paths + contents — interleaved.
 *   2. Pass the blob AND the SSR entry module to `bun build --compile`.
 *      - dist/server/server.js → Bun bundles it (and its import chain) as code
 *      - dist-blob.data         → Bun embeds it as a binary resource
 *   3. At runtime, server-prod.ts:
 *      - Uses the bundled SSR module (no disk access needed)
 *      - Reads the blob from Bun.embeddedFiles to build the static route map
 */

import { Glob } from 'bun'

// ── Scan dist/ ──────────────────────────────────────────
const glob = new Glob('dist/**/*')
const distFiles: string[] = []
for await (const file of glob.scan('.')) {
  distFiles.push(file)
}
console.log(`[info] Found ${distFiles.length} file(s) in dist/`)

// ── Build binary blob ───────────────────────────────────
// Format (header + content interleaved):
//   [4 bytes: file count N, uint32 LE]
//   For each file:
//     [2 bytes: path length P, uint16 LE]
//     [P bytes: UTF-8 path]
//     [4 bytes: content length C, uint32 LE]
//     [C bytes: raw content]

interface FileEntry {
  path: string
  content: Uint8Array
}
const entries: FileEntry[] = []
let totalSize = 4 // file count header

for (const rel of distFiles) {
  const data = new Uint8Array(await Bun.file(rel).arrayBuffer())
  const pathBytes = Buffer.byteLength(rel, 'utf-8')
  totalSize += 2 + pathBytes + 4 + data.length
  entries.push({ path: rel, content: data })
}

const buf = Buffer.alloc(totalSize)
let offset = 0
buf.writeUInt32LE(entries.length, offset)
offset += 4

for (const { path, content } of entries) {
  const pathBytes = Buffer.byteLength(path, 'utf-8')
  buf.writeUInt16LE(pathBytes, offset);    offset += 2
  buf.write(path, offset, 'utf-8');         offset += pathBytes
  buf.writeUInt32LE(content.length, offset); offset += 4
  Buffer.from(content).copy(buf, offset);    offset += content.length
}

await Bun.write('dist-blob.data', buf)
console.log(`[info] Wrote dist-blob.data (${(totalSize / 1024 / 1024).toFixed(1)} MB)`)

// ── Compile ─────────────────────────────────────────────
// server-prod.ts     — main entry point
// dist-blob.data     — embedded as binary resource (all client assets)
// dist/server/server.js — embedded as code (SSR handler + dependency chain)
const proc = Bun.spawnSync(
  [
    'bun', 'build', '--compile',
    '--splitting',
    '--minify-whitespace',
    '--minify-syntax',
    '--target','bun',
    './server-prod.ts',
    './dist/server/server.js',
    './dist-blob.data',
    '--outfile', './server',
  ],
  { stdio: ['inherit', 'inherit', 'inherit'] },
)

// Clean up
const { unlinkSync } = await import('node:fs')
try { unlinkSync('dist-blob.data') } catch {}

if (proc.exitCode !== 0) {
  console.error('[err] Compilation failed (exit code: ' + proc.exitCode + ')')
  process.exit(proc.exitCode ?? 1)
}

console.log('[ ok ] Build succeeded! Output: ./server')
