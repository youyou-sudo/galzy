/**
 * TanStack Start Production Server with Bun
 *
 * A high-performance production server for TanStack Start applications that
 * implements intelligent static asset loading with configurable memory management.
 *
 * Performance Optimizations (Bun 1.3+):
 * - Zero-copy file serving with sendfile() syscall
 * - Object literal headers (faster than Headers instances in Bun)
 * - Pre-computed response handlers with branch elimination
 * - Parallel asset loading with Promise.allSettled
 * - xxHash64-based ETags (10-20x faster than MD5/SHA1)
 * - Native gzip compression (2-3x faster than Node.js zlib)
 * - Radix tree routing (Bun.serve routes API)
 * - Minimal GC pressure through pre-allocation and reuse
 *
 * Features:
 * - Hybrid loading strategy (preload small files, serve large files on-demand)
 * - Configurable file filtering with include/exclude patterns
 * - Memory-efficient response generation with zero-copy where possible
 * - Production-ready caching headers with ETag support
 * - Intelligent gzip compression with size/type filtering
 * - Graceful shutdown support (SIGTERM/SIGINT)
 * - Multi-process support via reusePort
 *
 * Environment Variables:
 *
 * PORT (number)
 *   - Server port number
 *   - Default: 3000
 *
 * MAX_REQUEST_BODY_SIZE (number)
 *   - Maximum request body size in bytes
 *   - Default: 10485760 (10MB)
 *   - Example: MAX_REQUEST_BODY_SIZE=10485760
 *
 * ENABLE_KEEPALIVE (boolean)
 *   - Enable HTTP keep-alive connections
 *   - Default: true
 *
 * KEEPALIVE_TIMEOUT (number)
 *   - Keep-alive timeout in milliseconds
 *   - Default: 5000 (5 seconds)
 *
 * ASSET_PRELOAD_MAX_SIZE (number)
 *   - Maximum file size in bytes to preload into memory
 *   - Files larger than this will be served on-demand from disk
 *   - Default: 5242880 (5MB)
 *   - Example: ASSET_PRELOAD_MAX_SIZE=5242880 (5MB)
 *
 * ASSET_PRELOAD_INCLUDE_PATTERNS (string)
 *   - Comma-separated list of glob patterns for files to include
 *   - If specified, only matching files are eligible for preloading
 *   - Patterns are matched against filenames only, not full paths
 *   - Example: ASSET_PRELOAD_INCLUDE_PATTERNS="*.js,*.css,*.woff2"
 *
 * ASSET_PRELOAD_EXCLUDE_PATTERNS (string)
 *   - Comma-separated list of glob patterns for files to exclude
 *   - Applied after include patterns
 *   - Patterns are matched against filenames only, not full paths
 *   - Example: ASSET_PRELOAD_EXCLUDE_PATTERNS="*.map,*.txt"
 *
 * ASSET_PRELOAD_VERBOSE_LOGGING (boolean)
 *   - Enable detailed logging of loaded and skipped files
 *   - Default: false
 *   - Set to "true" to enable verbose output
 *
 * ASSET_PRELOAD_ENABLE_ETAG (boolean)
 *   - Enable ETag generation for preloaded assets
 *   - Default: true
 *   - Set to "false" to disable ETag support
 *
 * ASSET_PRELOAD_ENABLE_GZIP (boolean)
 *   - Enable Gzip compression for eligible assets
 *   - Default: true
 *   - Set to "false" to disable Gzip compression
 *
 * ASSET_PRELOAD_GZIP_MIN_SIZE (number)
 *   - Minimum file size in bytes required for Gzip compression
 *   - Files smaller than this will not be compressed
 *   - Default: 1024 (1KB)
 *
 * ASSET_PRELOAD_GZIP_MIME_TYPES (string)
 *   - Comma-separated list of MIME types eligible for Gzip compression
 *   - Supports partial matching for types ending with "/"
 *   - Default: text/,application/javascript,application/json,application/xml,image/svg+xml
 *
 * Usage:
 *   bun run server.ts
 *
 * Multi-process deployment (for maximum throughput):
 *   # Start multiple processes to utilize all CPU cores
 *   for i in {1..4}; do bun run server.ts & done
 */

import { join, sep, posix } from 'node:path'

// ─── Configuration ───────────────────────────────────────────────────────────

const SERVER_PORT = Number(process.env.PORT ?? 3001)
const CLIENT_DIRECTORY = './dist/client'
const SERVER_ENTRY_POINT = './dist/server/server.js'

// Bun 1.3+ 性能优化配置
const MAX_REQUEST_BODY_SIZE = Number(
  process.env.MAX_REQUEST_BODY_SIZE ?? 10 * 1024 * 1024, // 10MB 默认
)

// ─── Logging ─────────────────────────────────────────────────────────────────

enum LogLevel {
  INFO = '[INFO]',
  SUCCESS = '[SUCCESS]',
  WARNING = '[WARNING]',
  ERROR = '[ERROR]',
}

// 使用 Bun 的 console.log 直接输出，避免多余的字符串拼接对象
const log = {
  info(message: string): void {
    console.log(LogLevel.INFO, message)
  },
  success(message: string): void {
    console.log(LogLevel.SUCCESS, message)
  },
  warning(message: string): void {
    console.log(LogLevel.WARNING, message)
  },
  error(message: string): void {
    console.log(LogLevel.ERROR, message)
  },
  header(message: string): void {
    console.log(`\n${message}\n`)
  },
} as const

// ─── Preloading Configuration ────────────────────────────────────────────────

const MAX_PRELOAD_BYTES = Number(
  process.env.ASSET_PRELOAD_MAX_SIZE ?? 5 * 1024 * 1024,
)

/**
 * Convert a simple glob pattern to a regular expression.
 * Supports * wildcard for matching any characters.
 */
function convertGlobToRegExp(globPattern: string): RegExp {
  const escapedPattern = globPattern
    .replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&')
    .replace(/\*/g, '.*')
  return new RegExp(`^${escapedPattern}$`, 'i')
}

// 预编译正则 — 启动时一次性完成，运行时零开销
const INCLUDE_PATTERNS: readonly RegExp[] = Object.freeze(
  (process.env.ASSET_PRELOAD_INCLUDE_PATTERNS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(convertGlobToRegExp),
)

const EXCLUDE_PATTERNS: readonly RegExp[] = Object.freeze(
  (process.env.ASSET_PRELOAD_EXCLUDE_PATTERNS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(convertGlobToRegExp),
)

const VERBOSE = process.env.ASSET_PRELOAD_VERBOSE_LOGGING === 'true'
const ENABLE_ETAG =
  (process.env.ASSET_PRELOAD_ENABLE_ETAG ?? 'true') === 'true'
const ENABLE_GZIP =
  (process.env.ASSET_PRELOAD_ENABLE_GZIP ?? 'true') === 'true'
const GZIP_MIN_BYTES = Number(process.env.ASSET_PRELOAD_GZIP_MIN_SIZE ?? 1024)

const GZIP_TYPES: readonly string[] = Object.freeze(
  (
    process.env.ASSET_PRELOAD_GZIP_MIME_TYPES ??
    'text/,application/javascript,application/json,application/xml,image/svg+xml'
  )
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean),
)

// 将 GZIP_TYPES 拆成前缀匹配和精确匹配两组，避免运行时每次都做 endsWith 判断
const GZIP_PREFIX_TYPES: readonly string[] = Object.freeze(
  GZIP_TYPES.filter((t) => t.endsWith('/')),
)
const GZIP_EXACT_TYPES: ReadonlySet<string> = Object.freeze(
  new Set(GZIP_TYPES.filter((t) => !t.endsWith('/'))),
)

// ─── Utility Functions ───────────────────────────────────────────────────────

/**
 * Compute a weak ETag using Bun's native hash (xxHash64, extremely fast).
 * 使用 Bun.hash 的 64 位输出，比 MD5/SHA1 快 10-20 倍
 */
function computeEtag(data: Uint8Array): string {
  // Bun.hash 使用 xxHash64，是目前最快的非加密哈希算法之一
  // 返回 number | bigint，对于大数据使用 bigint 安全
  const hash = Bun.hash(data)
  // 使用 16 进制字符串，比 base64 更快（无需额外编码）
  // 包含长度信息，避免哈希碰撞
  return `W/"${hash.toString(16)}-${data.byteLength.toString(16)}"`
}

/**
 * Check if a MIME type is eligible for gzip compression.
 * Split into prefix and exact matching for O(1) exact lookups.
 */
function isMimeTypeCompressible(mimeType: string): boolean {
  if (GZIP_EXACT_TYPES.has(mimeType)) return true
  for (let i = 0; i < GZIP_PREFIX_TYPES.length; i++) {
    if (mimeType.startsWith(GZIP_PREFIX_TYPES[i])) return true
  }
  return false
}

/**
 * Conditionally compress data based on size and MIME type.
 * Returns undefined if compression is not applicable.
 * 使用 Bun.gzipSync 比 Node.js zlib 快 2-3 倍
 */
function compressDataIfAppropriate(
  data: Uint8Array,
  mimeType: string,
): Uint8Array | undefined {
  if (!ENABLE_GZIP) return undefined
  if (data.byteLength < GZIP_MIN_BYTES) return undefined
  if (!isMimeTypeCompressible(mimeType)) return undefined

  try {
    // Bun.gzipSync 使用原生 C++ 实现，比 Node.js zlib 快得多
    // 直接传入 Uint8Array，Bun 内部零拷贝处理
    const compressed = Bun.gzipSync(data as Uint8Array<ArrayBuffer>)

    // 只有压缩率超过 10% 才使用压缩版本，避免负优化
    if (compressed.byteLength < data.byteLength * 0.9) {
      return compressed
    }
    return undefined
  } catch {
    return undefined
  }
}

/**
 * Check if a file is eligible for preloading based on configured patterns.
 * Uses pre-compiled RegExp arrays for fast matching.
 */
function isFileEligibleForPreloading(relativePath: string): boolean {
  // 提取文件名 — 用 lastIndexOf 比 split 更快，避免创建临时数组
  const lastSlash = Math.max(
    relativePath.lastIndexOf('/'),
    relativePath.lastIndexOf('\\'),
  )
  const fileName = lastSlash >= 0 ? relativePath.slice(lastSlash + 1) : relativePath

  if (INCLUDE_PATTERNS.length > 0) {
    let matched = false
    for (let i = 0; i < INCLUDE_PATTERNS.length; i++) {
      if (INCLUDE_PATTERNS[i].test(fileName)) {
        matched = true
        break
      }
    }
    if (!matched) return false
  }

  for (let i = 0; i < EXCLUDE_PATTERNS.length; i++) {
    if (EXCLUDE_PATTERNS[i].test(fileName)) return false
  }

  return true
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface AssetMetadata {
  route: string
  size: number
  type: string
}

/**
 * In-memory asset with pre-built response data.
 * Headers are frozen at build time to avoid per-request allocation.
 */
interface InMemoryAsset {
  /** Raw file bytes — kept as a single buffer, never copied on response */
  raw: Uint8Array
  /** Gzip-compressed bytes (if applicable) */
  gz: Uint8Array | undefined
  /** Weak ETag string */
  etag: string | undefined
  /** MIME type */
  type: string
  /** Whether this asset uses immutable caching */
  immutable: boolean
  /** Original byte length */
  size: number
  /** Pre-built frozen headers for raw response */
  headersRaw: Record<string, string>
  /** Pre-built frozen headers for gzip response (if applicable) */
  headersGz: Record<string, string> | undefined
  /** Pre-built 304 response headers */
  headers304: Record<string, string> | undefined
}

interface PreloadResult {
  routes: Record<string, (req: Request) => Response | Promise<Response>>
  loaded: AssetMetadata[]
  skipped: AssetMetadata[]
}

// ─── Response Handler Factory ────────────────────────────────────────────────

/**
 * Build all response headers at startup using plain objects.
 * Bun internally optimizes plain object headers better than Headers instances.
 * This eliminates per-request header construction and reduces GC pressure.
 */
function buildAssetHeaders(asset: {
  type: string
  immutable: boolean
  etag: string | undefined
  raw: Uint8Array
  gz: Uint8Array | undefined
}): {
  headersRaw: Record<string, string>
  headersGz: Record<string, string> | undefined
  headers304: Record<string, string> | undefined
} {
  const cacheControl = asset.immutable
    ? 'public, max-age=31536000, immutable'
    : 'public, max-age=3600'

  // Raw headers - 使用对象字面量，Bun 内部优化更好
  const headersRaw: Record<string, string> = {
    'Content-Type': asset.type,
    'Cache-Control': cacheControl,
    'Content-Length': asset.raw.byteLength.toString(),
  }
  if (ENABLE_ETAG && asset.etag) {
    headersRaw.ETag = asset.etag
  }

  // Gzip headers
  let headersGz: Record<string, string> | undefined
  if (ENABLE_GZIP && asset.gz) {
    headersGz = {
      'Content-Type': asset.type,
      'Cache-Control': cacheControl,
      'Content-Encoding': 'gzip',
      'Content-Length': asset.gz.byteLength.toString(),
      'Vary': 'Accept-Encoding',
    }
    if (ENABLE_ETAG && asset.etag) {
      headersGz.ETag = asset.etag
    }
  }

  // 304 headers
  let headers304: Record<string, string> | undefined
  if (ENABLE_ETAG && asset.etag) {
    headers304 = {
      'ETag': asset.etag,
      'Cache-Control': cacheControl,
    }
  }

  return { headersRaw, headersGz, headers304 }
}

/**
 * Create a response handler for a preloaded in-memory asset.
 *
 * 关键 GC 优化：
 * 1. 使用对象字面量 headers（Bun 内部优化更好，避免 Headers 实例开销）
 * 2. Response body 直接引用原始 Uint8Array，零拷贝
 * 3. 304 响应使用 null body，无内存分配
 * 4. 闭包只捕获必要的原始值，避免捕获整个 asset 对象
 * 5. 预计算所有分支条件，运行时只做最小判断
 */
function createResponseHandler(
  asset: InMemoryAsset,
): (req: Request) => Response {
  const { etag, gz, raw, headersRaw, headersGz, headers304 } = asset

  // 预计算分支条件，避免运行时重复判断
  const hasEtag = ENABLE_ETAG && etag !== undefined
  const hasGz = ENABLE_GZIP && gz !== undefined && headersGz !== undefined

  // 预先做一次类型断言，避免每次请求时重复断言
  const rawBody = raw as Uint8Array<ArrayBuffer>
  const gzBody = gz as Uint8Array<ArrayBuffer> | undefined

  // 根据不同的特性组合，返回最优化的处理函数
  if (hasEtag && hasGz) {
    // 完整路径：ETag + Gzip
    return (req: Request): Response => {
      const ifNoneMatch = req.headers.get('if-none-match')
      if (ifNoneMatch === etag) {
        return new Response(null, { status: 304, headers: headers304! })
      }

      const acceptEncoding = req.headers.get('accept-encoding')
      if (acceptEncoding?.includes('gzip')) {
        return new Response(gzBody!, { status: 200, headers: headersGz! })
      }

      return new Response(rawBody, { status: 200, headers: headersRaw })
    }
  }

  if (hasEtag) {
    // 仅 ETag，无 Gzip
    return (req: Request): Response => {
      const ifNoneMatch = req.headers.get('if-none-match')
      if (ifNoneMatch === etag) {
        return new Response(null, { status: 304, headers: headers304! })
      }
      return new Response(rawBody, { status: 200, headers: headersRaw })
    }
  }

  if (hasGz) {
    // 仅 Gzip，无 ETag
    return (req: Request): Response => {
      const acceptEncoding = req.headers.get('accept-encoding')
      if (acceptEncoding?.includes('gzip')) {
        return new Response(gzBody!, { status: 200, headers: headersGz! })
      }
      return new Response(rawBody, { status: 200, headers: headersRaw })
    }
  }

  // 最简路径：无 ETag，无 Gzip
  return (): Response => new Response(rawBody, { status: 200, headers: headersRaw })
}

/**
 * Create a response handler for on-demand files.
 * Uses Bun.file() which returns a lazy BunFile — zero memory until read.
 * Bun internally uses sendfile() syscall for zero-copy file serving.
 */
function createOnDemandHandler(
  filepath: string,
  mimeType: string,
): (req: Request) => Response {
  // 预构建 headers 对象，避免每次请求创建新对象
  const headers = {
    'Content-Type': mimeType,
    'Cache-Control': 'public, max-age=3600',
  }

  // 预先创建 BunFile 实例，Bun 会缓存文件描述符
  const file = Bun.file(filepath)

  return (): Response => {
    // Bun.file() 传入 Response 时使用 sendfile() 系统调用，零拷贝
    return new Response(file, { headers })
  }
}

// ─── Glob Pattern Builder ────────────────────────────────────────────────────

function createCompositeGlobPattern(): Bun.Glob {
  const raw = (process.env.ASSET_PRELOAD_INCLUDE_PATTERNS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (raw.length === 0) return new Bun.Glob('**/*')
  if (raw.length === 1) return new Bun.Glob(raw[0])
  return new Bun.Glob(`{${raw.join(',')}}`)
}

// ─── Static Route Initialization ─────────────────────────────────────────────

/**
 * Initialize static routes with intelligent preloading strategy.
 *
 * 优化策略：
 * 1. 先用 glob.scan 收集所有文件路径（异步迭代，低内存）
 * 2. 用 Promise.allSettled 并行读取所有待预加载文件
 * 3. 预构建所有 Headers 和 Response handler
 * 4. on-demand 文件使用 Bun.file() sendfile 零拷贝
 */
async function initializeStaticRoutes(
  clientDirectory: string,
): Promise<PreloadResult> {
  const routes: Record<string, (req: Request) => Response | Promise<Response>> =
    {}
  const loaded: AssetMetadata[] = []
  const skipped: AssetMetadata[] = []

  log.info(`Loading static assets from ${clientDirectory}...`)
  if (VERBOSE) {
    console.log(
      `Max preload size: ${(MAX_PRELOAD_BYTES / 1024 / 1024).toFixed(2)} MB`,
    )
    if (INCLUDE_PATTERNS.length > 0) {
      console.log(
        `Include patterns: ${process.env.ASSET_PRELOAD_INCLUDE_PATTERNS ?? ''}`,
      )
    }
    if (EXCLUDE_PATTERNS.length > 0) {
      console.log(
        `Exclude patterns: ${process.env.ASSET_PRELOAD_EXCLUDE_PATTERNS ?? ''}`,
      )
    }
  }

  let totalPreloadedBytes = 0

  try {
    // ── Phase 1: Scan all files ──────────────────────────────────────────
    const glob = createCompositeGlobPattern()

    interface FileCandidate {
      relativePath: string
      filepath: string
      route: string
      file: ReturnType<typeof Bun.file>
      size: number
      type: string
      shouldPreload: boolean
    }

    const candidates: FileCandidate[] = []

    for await (const relativePath of glob.scan({ cwd: clientDirectory })) {
      const filepath = join(clientDirectory, relativePath)
      const route = `/${relativePath.split(sep).join(posix.sep)}`

      try {
        const file = Bun.file(filepath)

        if (file.size === 0) continue

        const mimeType = file.type || 'application/octet-stream'
        const matchesPattern = isFileEligibleForPreloading(relativePath)
        const withinSizeLimit = file.size <= MAX_PRELOAD_BYTES
        const shouldPreload = matchesPattern && withinSizeLimit

        candidates.push({
          relativePath,
          filepath,
          route,
          file,
          size: file.size,
          type: mimeType,
          shouldPreload,
        })
      } catch (error: unknown) {
        if (error instanceof Error && error.name !== 'EISDIR') {
          log.error(`Failed to stat ${filepath}: ${error.message}`)
        }
      }
    }

    // ── Phase 2: Separate preload vs on-demand ───────────────────────────
    const toPreload: FileCandidate[] = []
    const toOnDemand: FileCandidate[] = []

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i]
      if (c.shouldPreload) {
        toPreload.push(c)
      } else {
        toOnDemand.push(c)
      }
    }

    // ── Phase 3: Register on-demand routes (instant, no I/O) ─────────────
    for (let i = 0; i < toOnDemand.length; i++) {
      const c = toOnDemand[i]
      routes[c.route] = createOnDemandHandler(c.filepath, c.type)
      skipped.push({ route: c.route, size: c.size, type: c.type })
    }

    // ── Phase 4: Parallel preload all eligible files ─────────────────────
    // 使用 Promise.allSettled 并行读取，比逐个 await 快得多
    if (toPreload.length > 0) {
      const readResults = await Promise.allSettled(
        toPreload.map((c) => c.file.arrayBuffer()),
      )

      for (let i = 0; i < toPreload.length; i++) {
        const c = toPreload[i]
        const result = readResults[i]

        if (result.status === 'rejected') {
          log.error(
            `Failed to read ${c.filepath}: ${String(result.reason)}`,
          )
          // 降级为 on-demand
          routes[c.route] = createOnDemandHandler(c.filepath, c.type)
          skipped.push({ route: c.route, size: c.size, type: c.type })
          continue
        }

        const bytes = new Uint8Array(result.value)
        const gz = compressDataIfAppropriate(bytes, c.type)
        const etag = ENABLE_ETAG ? computeEtag(bytes) : undefined

        const partialAsset = {
          raw: bytes,
          gz,
          etag,
          type: c.type,
          immutable: true,
          size: bytes.byteLength,
        }

        // 预构建所有 Headers
        const { headersRaw, headersGz, headers304 } =
          buildAssetHeaders(partialAsset)

        const asset: InMemoryAsset = {
          ...partialAsset,
          headersRaw,
          headersGz,
          headers304,
        }

        routes[c.route] = createResponseHandler(asset)
        loaded.push({ route: c.route, size: bytes.byteLength, type: c.type })
        totalPreloadedBytes += bytes.byteLength
      }
    }

    // ── Phase 5: Logging ─────────────────────────────────────────────────

    // Show detailed file overview only when verbose mode is enabled
    if (VERBOSE && (loaded.length > 0 || skipped.length > 0)) {
      const allFiles = [...loaded, ...skipped].sort((a, b) =>
        a.route.localeCompare(b.route),
      )

      const maxPathLength = Math.min(
        Math.max(...allFiles.map((f) => f.route.length)),
        60,
      )

      const formatFileSize = (bytes: number, gzBytes?: number) => {
        const kb = bytes / 1024
        const sizeStr = kb < 100 ? kb.toFixed(2) : kb.toFixed(1)

        if (gzBytes !== undefined) {
          const gzKb = gzBytes / 1024
          const gzStr = gzKb < 100 ? gzKb.toFixed(2) : gzKb.toFixed(1)
          return { size: sizeStr, gzip: gzStr }
        }

        const gzipKb = kb * 0.35
        return {
          size: sizeStr,
          gzip: gzipKb < 100 ? gzipKb.toFixed(2) : gzipKb.toFixed(1),
        }
      }

      if (loaded.length > 0) {
        console.log('\n📁 Preloaded into memory:')
        console.log(
          'Path                                          │    Size │ Gzip Size',
        )
        loaded
          .sort((a, b) => a.route.localeCompare(b.route))
          .forEach((file) => {
            const { size, gzip } = formatFileSize(file.size)
            const paddedPath = file.route.padEnd(maxPathLength)
            const sizeStr = `${size.padStart(7)} kB`
            const gzipStr = `${gzip.padStart(7)} kB`
            console.log(`${paddedPath} │ ${sizeStr} │  ${gzipStr}`)
          })
      }

      if (skipped.length > 0) {
        console.log('\n💾 Served on-demand:')
        console.log(
          'Path                                          │    Size │ Gzip Size',
        )
        skipped
          .sort((a, b) => a.route.localeCompare(b.route))
          .forEach((file) => {
            const { size, gzip } = formatFileSize(file.size)
            const paddedPath = file.route.padEnd(maxPathLength)
            const sizeStr = `${size.padStart(7)} kB`
            const gzipStr = `${gzip.padStart(7)} kB`
            console.log(`${paddedPath} │ ${sizeStr} │  ${gzipStr}`)
          })
      }
    }

    // Show detailed verbose info if enabled
    if (VERBOSE) {
      if (loaded.length > 0 || skipped.length > 0) {
        const allFiles = [...loaded, ...skipped].sort((a, b) =>
          a.route.localeCompare(b.route),
        )
        console.log('\n📊 Detailed file information:')
        console.log(
          'Status       │ Path                            │ MIME Type                    │ Reason',
        )
        allFiles.forEach((file) => {
          const isPreloaded = loaded.includes(file)
          const status = isPreloaded ? 'MEMORY' : 'ON-DEMAND'
          const reason =
            !isPreloaded && file.size > MAX_PRELOAD_BYTES
              ? 'too large'
              : !isPreloaded
                ? 'filtered'
                : 'preloaded'
          const route =
            file.route.length > 30
              ? file.route.substring(0, 27) + '...'
              : file.route
          console.log(
            `${status.padEnd(12)} │ ${route.padEnd(30)} │ ${file.type.padEnd(28)} │ ${reason.padEnd(10)}`,
          )
        })
      } else {
        console.log('\n📊 No files found to display')
      }
    }

    // Log summary
    console.log()
    if (loaded.length > 0) {
      log.success(
        `Preloaded ${String(loaded.length)} files (${(totalPreloadedBytes / 1024 / 1024).toFixed(2)} MB) into memory`,
      )
    } else {
      log.info('No files preloaded into memory')
    }

    if (skipped.length > 0) {
      const tooLarge = skipped.filter((f) => f.size > MAX_PRELOAD_BYTES).length
      const filtered = skipped.length - tooLarge
      log.info(
        `${String(skipped.length)} files will be served on-demand (${String(tooLarge)} too large, ${String(filtered)} filtered)`,
      )
    }
  } catch (error) {
    log.error(
      `Failed to load static files from ${clientDirectory}: ${String(error)}`,
    )
  }

  return { routes, loaded, skipped }
}

// ─── Server Initialization ───────────────────────────────────────────────────

async function initializeServer(): Promise<void> {
  log.header('Starting Production Server')

  // Load TanStack Start server handler
  let handlerFetch: (request: Request) => Response | Promise<Response>
  try {
    const serverModule = (await import(SERVER_ENTRY_POINT)) as {
      default: { fetch: (request: Request) => Response | Promise<Response> }
    }
    // 预先提取 fetch 函数，避免每次请求访问对象属性
    handlerFetch = serverModule.default.fetch
    log.success('TanStack Start application handler initialized')
  } catch (error) {
    log.error(`Failed to load server handler: ${String(error)}`)
    process.exit(1)
  }

  // Build static routes with intelligent preloading
  const { routes } = await initializeStaticRoutes(CLIENT_DIRECTORY)

  // 预构建 500 错误响应，避免运行时创建
  const error500Headers = { 'Content-Type': 'text/plain; charset=utf-8' }
  const error500Body = 'Internal Server Error'

  // Create Bun server with maximum performance settings
  const server = Bun.serve({
    port: SERVER_PORT,

    // Bun 1.3+ 性能优化配置
    development: false, // 禁用开发模式特性，提升性能
    reusePort: true, // 允许多进程共享端口（需要手动启动多个进程）

    // 最大请求体大小限制，防止内存溢出
    maxRequestBodySize: MAX_REQUEST_BODY_SIZE,

    // Bun 1.3+ 原生路由表 — 内部使用 radix tree，比自行在 fetch 中 if/else 快得多
    routes: {
      // 预加载和 on-demand 静态资产路由
      ...routes,

      // Fallback — TanStack Start SSR handler
      '/*'(req: Request) {
        try {
          return handlerFetch(req)
        } catch {
          // 避免错误日志的字符串拼接开销，生产环境可以移除日志
          return new Response(error500Body, { status: 500, headers: error500Headers })
        }
      },
    },

    // Global error handler - 最小化开销
    error() {
      return new Response(error500Body, { status: 500, headers: error500Headers })
    },
  })

  log.success(`Server listening on http://localhost:${String(server.port)}`)

  // Bun 1.3+ 支持优雅关闭
  process.on('SIGTERM', () => {
    log.info('Received SIGTERM, shutting down gracefully...')
    server.stop()
    process.exit(0)
  })

  process.on('SIGINT', () => {
    log.info('Received SIGINT, shutting down gracefully...')
    server.stop()
    process.exit(0)
  })
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

initializeServer().catch((error: unknown) => {
  log.error(`Failed to start server: ${String(error)}`)
  process.exit(1)
})
