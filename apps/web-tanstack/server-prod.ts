/**
 * TanStack Start — Production Server (Bun)
 *
 * Optimized for: low memory footprint, minimal per-request GC pressure,
 * fast cold start.  Combines the hybrid preload/on-demand strategy of the
 * official server with the zero-copy, pre-built-header approach of the
 * ultra variant, plus Brotli-first compression.
 *
 * ── Strategy ──
 *  1. Compiled mode: read dist-blob.data from Bun.embeddedFiles, parse
 *     the binary bundle, build static route map from memory.
 *  2. Disk mode: scan dist/client with Bun.Glob (parallel I/O).
 *  3. Files ≤ MAX_SIZE are preloaded into RAM with pre-built Response
 *     init objects (no per-request allocations).
 *  4. Files > MAX_SIZE stay on disk / in bundle — served on-demand.
 *  5. Pre-built compressed variants (.br / .gz) are picked up if they
 *     exist next to the source file (no runtime compression).
 *  6. ETag-based 304 responses avoid re-sending bodies.
 *
 * ── Env vars ──
 *   PORT                        default 3000
 *   ASSET_PRELOAD_MAX_SIZE      bytes, default 5 MB
 *   ASSET_PRELOAD_INCLUDE       comma globs, e.g. "*.js,*.css"
 *   ASSET_PRELOAD_EXCLUDE       comma globs, e.g. "*.map"
 *   ASSET_PRELOAD_VERBOSE       "true" for per-file listing
 *   SSR_TIMEOUT_MS              SSR hard timeout (ms), default 55000
 */

import { join } from 'node:path'

// ── Config ──────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3000)
const CLIENT_DIR = './dist/client'

const MAX_BYTES = Number(process.env.ASSET_PRELOAD_MAX_SIZE ?? 5 * 1024 * 1024)
const VERBOSE = process.env.ASSET_PRELOAD_VERBOSE === 'true'

// ── SSR timeout ────────────────────────────────────
// Hard cap: abort the SSR promise if it hasn't resolved.
// Set below React 19's internal 120s stream lifetime to preempt it.
const SSR_TIMEOUT_MS = Number(process.env.SSR_TIMEOUT_MS ?? 55_000)

// ── Filter patterns ─────────────────────────────────
const INCLUDE = (process.env.ASSET_PRELOAD_INCLUDE ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const EXCLUDE = (process.env.ASSET_PRELOAD_EXCLUDE ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function globToRe(glob: string): RegExp {
  const e = glob.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${e}$`, 'i')
}

const INCLUDE_RE: readonly RegExp[] = INCLUDE.map(globToRe)
const EXCLUDE_RE: readonly RegExp[] = EXCLUDE.map(globToRe)

function matchesAny(name: string, patterns: readonly RegExp[]): boolean {
  for (let i = 0; i < patterns.length; i++) {
    if (patterns[i].test(name)) return true
  }
  return false
}

function eligible(fileName: string, size: number): boolean {
  if (size > MAX_BYTES) return false
  if (INCLUDE.length > 0 && !matchesAny(fileName, INCLUDE_RE)) return false
  if (EXCLUDE.length > 0 && matchesAny(fileName, EXCLUDE_RE)) return false
  return true
}

// ── MIME ────────────────────────────────────────────
const MIME_MAP: Record<string, string> = Object.freeze({
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  mjs: 'application/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  eot: 'application/vnd.ms-fontobject',
  txt: 'text/plain; charset=utf-8',
  wasm: 'application/wasm',
})

function mime(fileName: string, fallback: string): string {
  const ext = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase()
  return MIME_MAP[ext] ?? fallback
}

// ── Static route map ────────────────────────────────
type Handler = (req: Request) => Response
const statics: Record<string, Handler> = Object.create(null)

// ── Shared asset handler factory ────────────────────
function createAssetHandler(
  raw: Uint8Array,
  ct: string,
  etag: string,
  br?: Uint8Array,
  gz?: Uint8Array,
): Handler {
  const cache = 'public, max-age=31536000, immutable'
  const sl = String(raw.length)

  const hRaw: ResponseInit = Object.freeze({
    status: 200,
    headers: Object.freeze({
      'Content-Type': ct,
      'Cache-Control': cache,
      'Content-Length': sl,
      ETag: etag,
    }),
  })

  const hBr = br
    ? Object.freeze({
        status: 200,
        headers: Object.freeze({
          'Content-Type': ct,
          'Content-Encoding': 'br',
          'Cache-Control': cache,
          'Content-Length': String(br.length),
          ETag: etag,
          Vary: 'Accept-Encoding',
        }),
      })
    : undefined

  const hGz = gz
    ? Object.freeze({
        status: 200,
        headers: Object.freeze({
          'Content-Type': ct,
          'Content-Encoding': 'gzip',
          'Cache-Control': cache,
          'Content-Length': String(gz.length),
          ETag: etag,
          Vary: 'Accept-Encoding',
        }),
      })
    : undefined

  return (req: Request): Response => {
    if (req.headers.get('if-none-match') === etag) {
      return new Response(null, { status: 304 })
    }
    const ae = req.headers.get('accept-encoding')
    if (ae) {
      if (hBr && ae.includes('br')) return new Response(br!, hBr)
      if (hGz && ae.includes('gzip')) return new Response(gz!, hGz)
    }
    return new Response(raw, hRaw)
  }
}

// ── Build glob for scanning ─────────────────────────
function buildGlob(): Bun.Glob {
  if (INCLUDE.length === 0) return new Bun.Glob('**/*')
  if (INCLUDE.length === 1) return new Bun.Glob(INCLUDE[0])
  return new Bun.Glob(`{${INCLUDE.join(',')}}`)
}

// ── Load static assets from disk ────────────────────
async function loadStatics(): Promise<void> {
  const files: string[] = []
  const glob = buildGlob()
  for await (const f of glob.scan({ cwd: CLIENT_DIR })) files.push(f)
  if (files.length === 0) return

  let preloaded = 0
  let preloadedBytes = 0
  let onDemand = 0

  const tasks = files.map(async (rel) => {
    const abs = join(CLIENT_DIR, rel)
    const bf = Bun.file(abs)
    if (bf.size === 0) return

    const route = '/' + rel.replaceAll('\\', '/')
    const ct = mime(rel, bf.type || 'application/octet-stream')
    const size = bf.size

    if (!eligible(rel, size)) {
      statics[route] = () =>
        new Response(Bun.file(abs), {
          headers: { 'Content-Type': ct, 'Cache-Control': 'public, max-age=3600' },
        })
      onDemand++
      if (VERBOSE) console.log(`  [demand] ${route}  (${(size / 1024).toFixed(1)} kB)`)
      return
    }

    const raw = new Uint8Array(await bf.arrayBuffer())
    const etag = `W/"${Bun.hash(raw).toString(16)}-${raw.length}"`

    let br: Uint8Array | undefined
    let gz: Uint8Array | undefined
    const [brFile, gzFile] = [Bun.file(abs + '.br'), Bun.file(abs + '.gz')]
    if (brFile.size > 0) br = new Uint8Array(await brFile.arrayBuffer())
    if (gzFile.size > 0) gz = new Uint8Array(await gzFile.arrayBuffer())

    statics[route] = createAssetHandler(raw, ct, etag, br, gz)

    preloaded++
    preloadedBytes += raw.length
    if (VERBOSE)
      console.log(
        `  [memory] ${route}  (${(raw.length / 1024).toFixed(1)} kB)` +
          (br ? ` +br` : '') +
          (gz ? ` +gz` : ''),
      )
  })

  await Promise.all(tasks)

  console.log(
    `[ ok ] ${preloaded} file(s) preloaded  ` +
      `(${(preloadedBytes / 1024 / 1024).toFixed(1)} MB RAM)` +
      (onDemand ? `, ${onDemand} on-demand` : ''),
  )
}

// ── Load static assets from dist-blob.data (compiled mode) ─
// The blob is a binary bundle created by build.ts containing
// all dist/ files with their full paths.
//
// Blob format:
//   [4 bytes: file count N, uint32 LE]
//   For each file:
//     [2 bytes: path length P, uint16 LE]
//     [P bytes: UTF-8 path]
//     [4 bytes: content length C, uint32 LE]
//     [C bytes: raw content]
//
async function loadStaticsFromBundle(): Promise<void> {
  const embedded: Blob[] = (Bun as any).embeddedFiles as Blob[] ?? []
  if (embedded.length === 0) return

  const bundle = embedded[0]
  if (!bundle || bundle.size === 0) return

  const data = new Uint8Array(await bundle.arrayBuffer())

  // Manual binary reads (avoiding DataView quirks in compiled mode)
  function u16(off: number): number {
    return data[off] | (data[off + 1] << 8)
  }
  function u32(off: number): number {
    return (
      data[off] +
      (data[off + 1] << 8) +
      (data[off + 2] << 16) +
      (data[off + 3] << 24)
    ) >>> 0
  }

  const decoder = new TextDecoder()
  let offset = 0

  const fileCount = u32(offset)
  offset += 4

  // First pass: collect all entries
  interface Entry { path: string; content: Uint8Array }
  const entries: Entry[] = []
  for (let i = 0; i < fileCount; i++) {
    const pathLen = u16(offset)
    offset += 2
    const path = decoder.decode(data.subarray(offset, offset + pathLen))
    offset += pathLen
    const contentLen = u32(offset)
    offset += 4
    const content = data.subarray(offset, offset + contentLen)
    offset += contentLen
    entries.push({ path, content })
  }

  // Group client files by base URL path (stripping .br/.gz)
  const CLIENT_PREFIX = 'dist/client/'
  const grouped: Record<string, { raw?: Uint8Array; br?: Uint8Array; gz?: Uint8Array }> =
    Object.create(null)

  for (const { path, content } of entries) {
    // Normalize Windows backslashes
    const npath = path.replaceAll('\\', '/')
    if (!npath.startsWith(CLIENT_PREFIX)) continue
    if (content.length === 0) continue

    const rel = npath.slice(CLIENT_PREFIX.length)
    let base: string
    let variant: 'raw' | 'br' | 'gz'

    if (rel.endsWith('.br')) {
      base = rel.slice(0, -3)
      variant = 'br'
    } else if (rel.endsWith('.gz')) {
      base = rel.slice(0, -3)
      variant = 'gz'
    } else {
      base = rel
      variant = 'raw'
    }

    const entry = (grouped[base] ??= {})
    entry[variant] = content
  }

  let groupedCount = 0
  for (const _k in grouped) { groupedCount++; break }
  if (groupedCount === 0) return

  let preloaded = 0
  let preloadedBytes = 0
  let onDemand = 0

  for (const [rel, variants] of Object.entries(grouped)) {
    const raw = variants.raw
    if (!raw) continue

    const route = '/' + rel.replaceAll('\\', '/')
    const ct = mime(rel, 'application/octet-stream')
    const size = raw.length

    if (!eligible(rel, size)) {
      statics[route] = () =>
        new Response(raw, {
          headers: { 'Content-Type': ct, 'Cache-Control': 'public, max-age=3600' },
        })
      onDemand++
      if (VERBOSE) console.log(`  [demand] ${route}  (${(size / 1024).toFixed(1)} kB)`)
      continue
    }

    const etag = `W/"${Bun.hash(raw).toString(16)}-${raw.length}"`
    const br = variants.br
    const gz = variants.gz

    statics[route] = createAssetHandler(raw, ct, etag, br, gz)

    preloaded++
    preloadedBytes += raw.length
    if (VERBOSE)
      console.log(
        `  [memory] ${route}  (${(raw.length / 1024).toFixed(1)} kB)` +
          (br ? ` +br` : '') +
          (gz ? ` +gz` : ''),
      )
  }

  console.log(
    `[ ok ] ${preloaded} file(s) preloaded from bundle  ` +
      `(${(preloadedBytes / 1024 / 1024).toFixed(1)} MB RAM)` +
      (onDemand ? `, ${onDemand} on-demand` : ''),
  )
}

// ── Fast URL → path extraction ──────────────────────
function fastPath(url: string): string {
  if (url.charCodeAt(0) === 47) return url
  const i = url.indexOf('/', 8)
  return i === -1 ? '/' : url.slice(i)
}

/**
 * Wrap the SSR ReadableStream so that mid-stream aborts (e.g. React's
 * internal 120s lifetime kill) don't crash the server.  On AbortError we
 * close the stream cleanly; the client already received headers and will
 * see a truncated body, but the server stays healthy.
 */
function safeSSRResponse(res: Response): Response {
  if (!res.body) return res
  const reader = res.body.getReader()
  let canceled = false
  const stream = new ReadableStream({
    async pull(controller) {
      if (canceled) return
      try {
        const { done, value } = await reader.read()
        if (done) {
          canceled = true
          controller.close()
          return
        }
        controller.enqueue(value)
      } catch (e) {
        if (e instanceof DOMException || (e as { name?: string }).name === 'AbortError') {
          try { controller.close() } catch {}
        } else {
          try { controller.error(e as Error) } catch {}
        }
        canceled = true
      }
    },
    cancel() {
      canceled = true
      reader.cancel().catch(() => {})
    },
  })
  return new Response(stream, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  })
}

// ── Healthcheck ─────────────────────────────────────
async function healthcheck(): Promise<void> {
  const HEALTH_PORT = Number(process.env.PORT ?? 3000)
  const url = `http://localhost:${HEALTH_PORT}/api/health`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) {
      console.error(`[err] Healthcheck failed: ${res.status} ${res.statusText}`)
      process.exit(1)
    }
    const body = await res.json() as { ok?: boolean }
    if (body.ok !== true) {
      console.error('[err] Healthcheck failed: unexpected response body')
      process.exit(1)
    }
    console.log('[ ok ] Healthcheck passed')
    process.exit(0)
  } catch (e) {
    console.error('[err] Healthcheck failed:', (e as Error).message)
    process.exit(1)
  }
}

// ── Main ────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('[info] Starting production server …')

  process.on('unhandledRejection', (reason) => {
    if (
      reason instanceof DOMException ||
      (reason as { name?: string }).name === 'AbortError'
    )
      return
    console.error('[err] unhandled rejection:', reason)
  })

  // Detect compiled mode
  const embedded = (Bun as any).embeddedFiles as Blob[] | undefined
  const isCompiled = embedded !== undefined && embedded.length > 0

  // Load SSR handler and static assets in parallel
  const [ssrMod] = await Promise.all([
    import('./dist/server/server.js') as Promise<{
      default: { fetch: (req: Request) => Response | Promise<Response> }
    }>,
    isCompiled
      ? loadStaticsFromBundle()
      : loadStatics(),
  ])

  Bun.serve({
    port: PORT,
    reusePort: true,

    async fetch(req) {
      const handler = statics[fastPath(req.url)]
      if (handler) return handler(req)

      try {
        let res: Response
        if (SSR_TIMEOUT_MS > 0) {
          const ac = new AbortController()
          const timer = setTimeout(() => ac.abort(), SSR_TIMEOUT_MS)
          res = await Promise.race([
            ssrMod.default.fetch(req),
            new Promise<never>((_, reject) => {
              ac.signal.addEventListener('abort', () => {
                reject(new DOMException('SSR request timed out', 'TimeoutError'))
              }, { once: true })
            }),
          ])
          clearTimeout(timer)
        } else {
          res = await ssrMod.default.fetch(req)
        }

        return safeSSRResponse(res)
      } catch (e) {
        if (e instanceof DOMException && e.name === 'TimeoutError') {
          return new Response('Gateway Timeout', { status: 504 })
        }
        console.error('[err]', e)
        return new Response('Internal Server Error', { status: 500 })
      }
    },

    error(e) {
      if (
        e instanceof DOMException ||
        (e as { name?: string }).name === 'AbortError'
      ) {
        return new Response(null, { status: 499 })
      }
      console.error('[err]', e)
      return new Response('Internal Server Error', { status: 500 })
    },
  })

  console.log(`[ ok ] Listening on http://localhost:${PORT}`)
}

const command = process.argv[2]
if (command === 'healthcheck') {
  healthcheck()
} else {
  main().catch((e) => {
    console.error('[err] Failed to start:', e)
    process.exit(1)
  })
}
