/**
 * TanStack Start — Production Server (Bun)
 *
 * Optimized for: low memory footprint, minimal per-request GC pressure,
 * fast cold start.  Combines the hybrid preload/on-demand strategy of the
 * official server with the zero-copy, pre-built-header approach of the
 * ultra variant, plus Brotli-first compression.
 *
 * ── Strategy ──
 *  1. Scan dist/client with Bun.Glob (parallel I/O via Promise.all).
 *  2. Files ≤ MAX_SIZE are preloaded into RAM with pre-built Response
 *     init objects (no per-request allocations).
 *  3. Files > MAX_SIZE stay on disk – served on-demand via Bun.file.
 *  4. Pre-built compressed variants (.br / .gz) are picked up if they
 *     exist next to the source file (no runtime compression).
 *  5. ETag-based 304 responses avoid re-sending bodies.
 *
 * ── Env vars ──
 *   PORT                        default 3000
 *   ASSET_PRELOAD_MAX_SIZE      bytes, default 5 MB
 *   ASSET_PRELOAD_INCLUDE       comma globs, e.g. "*.js,*.css"
 *   ASSET_PRELOAD_EXCLUDE       comma globs, e.g. "*.map"
 *   ASSET_PRELOAD_VERBOSE       "true" for per-file listing
 *   SSR_TIMEOUT_MS              SSR hard timeout (ms), default 55000
 *   SSR_DIAG_TIMEOUT_MS         diagnostic warning threshold (ms), default 15000
 *                                set to 0 to disable
 */

import { join } from 'node:path'

// ── Config ──────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3000)
const CLIENT_DIR = './dist/client'
const SSR_ENTRY = './dist/server/server.js'

const MAX_BYTES = Number(process.env.ASSET_PRELOAD_MAX_SIZE ?? 5 * 1024 * 1024)
const VERBOSE = process.env.ASSET_PRELOAD_VERBOSE === 'true'

// ── SSR timeout ────────────────────────────────────
// Hard cap: abort the SSR promise if it hasn't resolved.
// Set below React 19's internal 120s stream lifetime to preempt it.
const SSR_TIMEOUT_MS = Number(process.env.SSR_TIMEOUT_MS ?? 55_000)
// Soft threshold: print a warning if SSR is still rendering after this.
const SSR_DIAG_TIMEOUT_MS = Number(process.env.SSR_DIAG_TIMEOUT_MS ?? 15_000)

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

function matchesAny(name: string, patterns: readonly string[]): boolean {
  for (let i = 0; i < patterns.length; i++) {
    if (globToRe(patterns[i]).test(name)) return true
  }
  return false
}

function eligible(fileName: string, size: number): boolean {
  if (size > MAX_BYTES) return false
  if (INCLUDE.length > 0 && !matchesAny(fileName, INCLUDE)) return false
  if (EXCLUDE.length > 0 && matchesAny(fileName, EXCLUDE)) return false
  return true
}

// ── MIME ────────────────────────────────────────────
function mime(fileName: string, fallback: string): string {
  const ext = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase()
  const map: Record<string, string> = {
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
  }
  return map[ext] ?? fallback
}

// ── Static route map ────────────────────────────────
type Handler = (req: Request) => Response
const statics: Record<string, Handler> = Object.create(null)

// ── Build glob for scanning ─────────────────────────
function buildGlob(): Bun.Glob {
  if (INCLUDE.length === 0) return new Bun.Glob('**/*')
  if (INCLUDE.length === 1) return new Bun.Glob(INCLUDE[0])
  return new Bun.Glob(`{${INCLUDE.join(',')}}`)
}

// ── Load static assets ──────────────────────────────
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
      // ── on-demand handler ──
      statics[route] = () =>
        new Response(Bun.file(abs), {
          headers: { 'Content-Type': ct, 'Cache-Control': 'public, max-age=3600' },
        })
      onDemand++
      if (VERBOSE) console.log(`  [demand] ${route}  (${(size / 1024).toFixed(1)} kB)`)
      return
    }

    // ── preload into memory ──
    const raw = new Uint8Array(await bf.arrayBuffer())
    const etag = `W/"${Bun.hash(raw).toString(16)}-${raw.length}"`

    // Look for pre-compressed variants next to the original file
    let br: Uint8Array | undefined
    let gz: Uint8Array | undefined
    const [brFile, gzFile] = [Bun.file(abs + '.br'), Bun.file(abs + '.gz')]
    if (brFile.size > 0) br = new Uint8Array(await brFile.arrayBuffer())
    if (gzFile.size > 0) gz = new Uint8Array(await gzFile.arrayBuffer())

    // Pre-build all response init objects (no per-request allocations)
    const cache = 'public, max-age=31536000, immutable'

    const hRaw = Object.freeze({
      status: 200,
      headers: Object.freeze({
        'Content-Type': ct,
        'Cache-Control': cache,
        'Content-Length': String(raw.length),
        ETag: etag,
      } satisfies Record<string, string>),
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
          } satisfies Record<string, string>),
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
          } satisfies Record<string, string>),
        })
      : undefined

    // Each handler closes over the buffers + pre-built inits — zero allocs per call
    statics[route] = (req: Request): Response => {
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
        // React 19 aborts the stream after 120s → DOMException AbortError.
        // Also covers our own SSR_TIMEOUT_MS abort.
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

  // Load SSR handler and static assets in parallel
  const [ssrMod] = await Promise.all([
    import(SSR_ENTRY) as Promise<{
      default: { fetch: (req: Request) => Response | Promise<Response> }
    }>,
    loadStatics(),
  ])

  Bun.serve({
    port: PORT,
    reusePort: true,

    async fetch(req) {
      const handler = statics[fastPath(req.url)]
      if (handler) return handler(req)

      const url = req.url
      const start = performance.now()

      // Diagnostic timer: warn if SSR is slow (non-blocking)
      let diagTimer: ReturnType<typeof setTimeout> | undefined
      if (SSR_DIAG_TIMEOUT_MS > 0) {
        diagTimer = setTimeout(() => {
          const elapsed = (performance.now() - start).toFixed(0)
          console.warn(
            `[warn] Slow SSR (${elapsed}ms): ${req.method} ${url}`,
          )
        }, SSR_DIAG_TIMEOUT_MS)
      }

      try {
        let res: Response
        if (SSR_TIMEOUT_MS > 0) {
          // Race the SSR call against a hard timeout so we preempt React's
          // internal 120s stream lifetime and return a clean error response.
          const ac = new AbortController()
          const timer = setTimeout(() => ac.abort(), SSR_TIMEOUT_MS)
          res = await Promise.race([
            ssrMod.default.fetch(req),
            new Promise<never>((_, reject) => {
              ac.signal.addEventListener('abort', () => {
                reject(new DOMException('SSR request timed out', 'TimeoutError'))
              })
            }),
          ])
          clearTimeout(timer)
        } else {
          res = await ssrMod.default.fetch(req)
        }

        clearTimeout(diagTimer)
        const elapsed = (performance.now() - start).toFixed(0)
        if (Number(elapsed) > 100) {
          console.log(`[req] ${req.method} ${url} — ${elapsed}ms`)
        }
        return safeSSRResponse(res)
      } catch (e) {
        clearTimeout(diagTimer)
        const elapsed = (performance.now() - start).toFixed(0)
        if (e instanceof DOMException && e.name === 'TimeoutError') {
          console.error(
            `[err] SSR timeout (${elapsed}ms): ${req.method} ${url}`,
          )
          return new Response('Gateway Timeout', { status: 504 })
        }
        console.error(`[err] SSR failed (${elapsed}ms): ${req.method} ${url}`, e)
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

main().catch((e) => {
  console.error('[err] Failed to start:', e)
  process.exit(1)
})
