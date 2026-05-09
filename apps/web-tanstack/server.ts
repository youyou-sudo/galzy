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
 * - Smart file prioritization (small files first for better cache hit rate)
 * - Pre-built error responses to eliminate runtime allocation
 *
 * Security Features:
 * - Path traversal attack prevention (../ detection)
 * - Suspicious character filtering in paths
 * - Null byte injection protection
 * - Request method validation (whitelist approach)
 * - Request header size limits (8KB max)
 * - File size validation (prevents oversized file attacks)
 * - Total memory limit enforcement (prevents OOM)
 * - Security response headers (X-Content-Type-Options, X-Frame-Options, etc.)
 * - CORS preflight handling
 *
 * Features:
 * - Hybrid loading strategy (preload small files, serve large files on-demand)
 * - Configurable file filtering with include/exclude patterns
 * - Memory-efficient response generation with zero-copy where possible
 * - Production-ready caching headers with ETag support
 * - Intelligent gzip compression with size/type filtering
 * - Graceful shutdown support (SIGTERM/SIGINT)
 * - Multi-process support via reusePort
 * - Optional memory monitoring and alerting
 *
 * Environment Variables:
 *
 * PORT (number)
 *   - Server port number
 *   - Default: 3001
 *
 * MAX_REQUEST_BODY_SIZE (number)
 *   - Maximum request body size in bytes
 *   - Default: 10485760 (10MB)
 *   - Security: Prevents memory exhaustion attacks
 *
 * MAX_STATIC_FILE_SIZE (number)
 *   - Maximum size in bytes for any individual static file to be served
 *   - Default: 104857600 (100MB)
 *   - Prevents oversized file attacks via static asset routes
 *
 * MAX_TOTAL_PRELOAD_BYTES (number)
 *   - Maximum total memory for preloaded assets (including gzip copies)
 *   - Default: 104857600 (100MB)
 *   - Security: Prevents OOM by limiting total preload size
 *
 * ASSET_PRELOAD_MAX_SIZE (number)
 *   - Maximum file size in bytes to preload into memory
 *   - Files larger than this will be served on-demand from disk
 *   - Default: 5242880 (5MB)
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
 *
 * ASSET_PRELOAD_ENABLE_ETAG (boolean)
 *   - Enable ETag generation for preloaded assets
 *   - Default: true
 *
 * ASSET_PRELOAD_ENABLE_GZIP (boolean)
 *   - Enable Gzip compression for eligible assets
 *   - Default: true
 *
 * ASSET_PRELOAD_GZIP_MIN_SIZE (number)
 *   - Minimum file size in bytes required for Gzip compression
 *   - Default: 1024 (1KB)
 *
 * ASSET_PRELOAD_GZIP_MIME_TYPES (string)
 *   - Comma-separated list of MIME types eligible for Gzip compression
 *   - Default: text/,application/javascript,application/json,application/xml,image/svg+xml
 *
 * ENABLE_MEMORY_MONITORING (boolean)
 *   - Enable periodic memory usage monitoring and logging
 *   - Default: false
 *   - Logs memory stats every 60 seconds when enabled
 *
 * ENABLE_SCHEDULED_GC (boolean)
 *   - Enable periodic manual garbage collection via Bun.gc()
 *   - Default: false
 *   - Helps keep memory usage stable under sustained load
 *
 * SCHEDULED_GC_INTERVAL_MS (number)
 *   - Interval in milliseconds between scheduled GC runs
 *   - Default: 30000 (30 seconds)
 *
 * SCHEDULED_GC_HEAP_THRESHOLD (number)
 *   - Heap usage threshold in bytes; GC is only triggered when
 *     heapUsed exceeds this value, avoiding unnecessary collections
 *   - Default: 0 (always collect on interval)
 *   - Example: 104857600 (100MB) — only GC when heap > 100MB
 *
 * Usage:
 *   bun run server.ts
 *
 * Multi-process deployment (for maximum throughput):
 *   # Start multiple processes to utilize all CPU cores
 *   for i in {1..4}; do bun run server.ts & done
 */

import { join, posix, sep } from 'node:path'

// ─── Configuration ───────────────────────────────────────────────────────────

const SERVER_PORT = Number(process.env.PORT ?? 3001)
const CLIENT_DIRECTORY = './dist/client'
const SERVER_ENTRY_POINT = './dist/server/server.js'

// Bun 1.3+ 性能优化配置
const MAX_REQUEST_BODY_SIZE = Number(
  process.env.MAX_REQUEST_BODY_SIZE ?? 10 * 1024 * 1024, // 10MB 默认
)

// 🔧 修复：新增独立的静态文件大小限制，不再混用 MAX_REQUEST_BODY_SIZE
const MAX_STATIC_FILE_SIZE = Number(
  process.env.MAX_STATIC_FILE_SIZE ?? 100 * 1024 * 1024, // 100MB 默认
)

// 安全配置：总内存限制，防止 OOM（包括 gzip 副本）
const MAX_TOTAL_PRELOAD_BYTES = Number(
  process.env.MAX_TOTAL_PRELOAD_BYTES ?? 100 * 1024 * 1024, // 100MB 默认
)

// 定时 GC 配置
const ENABLE_SCHEDULED_GC = process.env.ENABLE_SCHEDULED_GC === 'true'
const SCHEDULED_GC_INTERVAL_MS = Number(
  process.env.SCHEDULED_GC_INTERVAL_MS ?? 30_000, // 30 秒默认
)
const SCHEDULED_GC_HEAP_THRESHOLD = Number(
  process.env.SCHEDULED_GC_HEAP_THRESHOLD ?? 0, // 0 = 每次间隔都执行
)

// ─── Security Configuration ──────────────────────────────────────────────────

// 安全响应头（预构建，避免每次请求创建）
const SECURITY_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
})

// 路径遍历攻击防护：预编译正则
const PATH_TRAVERSAL_PATTERN = /(?:^|[\\/])\.\.(?:[\\/]|$)/
// 检测可疑字符：<>:"|?*
const SUSPICIOUS_CHARS_PATTERN = /[<>:"|?*]/

/**
 * 检测字符串中是否包含控制字符 (0x00-0x1F)
 */
function hasControlCharacters(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code >= 0 && code <= 0x1F) return true
  }
  return false
}

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
 * 安全路径验证：防止路径遍历攻击
 * 在处理任何用户输入的路径前必须调用
 */
function isPathSafe(path: string): boolean {
  // 检查路径遍历模式
  if (PATH_TRAVERSAL_PATTERN.test(path)) return false
  // 检查可疑字符
  if (SUSPICIOUS_CHARS_PATTERN.test(path)) return false
  // 检查控制字符
  if (hasControlCharacters(path)) return false
  // 检查空字节注入
  if (path.includes('\0')) return false
  return true
}

/**
 * Compute a weak ETag using Bun's native hash (xxHash64, extremely fast).
 * 使用 Bun.hash 的 64 位输出，比 MD5/SHA1 快 10-20 倍
 */
function computeEtag(data: Uint8Array): string {
  const hash = Bun.hash(data)
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
  raw: Uint8Array
  gz: Uint8Array | undefined
  etag: string | undefined
  type: string
  immutable: boolean
  size: number
  headersRaw: Record<string, string>
  headersGz: Record<string, string> | undefined
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

  const headersRaw: Record<string, string> = {
    ...SECURITY_HEADERS,
    'Content-Type': asset.type,
    'Cache-Control': cacheControl,
    'Content-Length': asset.raw.byteLength.toString(),
  }
  if (ENABLE_ETAG && asset.etag) {
    headersRaw.ETag = asset.etag
  }

  let headersGz: Record<string, string> | undefined
  if (ENABLE_GZIP && asset.gz) {
    headersGz = {
      ...SECURITY_HEADERS,
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

  let headers304: Record<string, string> | undefined
  if (ENABLE_ETAG && asset.etag) {
    headers304 = {
      ...SECURITY_HEADERS,
      'ETag': asset.etag,
      'Cache-Control': cacheControl,
    }
  }

  return { headersRaw, headersGz, headers304 }
}

/**
 * 🔧 修复后的 Accept-Encoding 检查：正确处理质量值
 */
function acceptsGzip(acceptEncoding: string | null): boolean {
  if (!acceptEncoding) return false
  // 简单解析：查找 gzip 标记，并确保没有 q=0 明确拒绝
  const tokens = acceptEncoding.split(',').map(s => s.trim().split(';')[0])
  if (!tokens.includes('gzip')) return false
  // 检查是否有 gzip;q=0 明确拒绝
  const gzipEntries = acceptEncoding.match(/gzip\s*(;\s*q\s*=\s*([0-9.]+))?/gi)
  if (!gzipEntries) return false
  for (const entry of gzipEntries) {
    const qMatch = entry.match(/q\s*=\s*([0-9.]+)/i)
    if (qMatch) {
      const qValue = parseFloat(qMatch[1])
      if (qValue === 0) return false
    }
  }
  return true
}

/**
 * 🔧 修复后的 ETag 匹配：支持多个 ETag 值
 */
function matchesEtag(clientHeader: string | null, assetEtag: string): boolean {
  if (!clientHeader) return false
  const etags = clientHeader.split(',').map(s => s.trim())
  return etags.includes(assetEtag)
}

/**
 * Create a response handler for a preloaded in-memory asset.
 * 使用修正后的工具函数处理条件请求。
 */
function createResponseHandler(
  asset: InMemoryAsset,
): (req: Request) => Response {
  const { etag, gz, raw, headersRaw, headersGz, headers304 } = asset

  const hasEtag = ENABLE_ETAG && etag !== undefined
  const hasGz = ENABLE_GZIP && gz !== undefined && headersGz !== undefined

  const rawBody = raw as Uint8Array<ArrayBuffer>
  const gzBody = gz as Uint8Array<ArrayBuffer> | undefined

  if (hasEtag && hasGz) {
    return (req: Request): Response => {
      // 🔧 使用 matchesEtag 而非严格相等
      if (matchesEtag(req.headers.get('if-none-match'), etag!)) {
        return new Response(null, { status: 304, headers: headers304! })
      }

      if (acceptsGzip(req.headers.get('accept-encoding'))) {
        return new Response(gzBody!, { status: 200, headers: headersGz! })
      }

      return new Response(rawBody, { status: 200, headers: headersRaw })
    }
  }

  if (hasEtag) {
    return (req: Request): Response => {
      if (matchesEtag(req.headers.get('if-none-match'), etag!)) {
        return new Response(null, { status: 304, headers: headers304! })
      }
      return new Response(rawBody, { status: 200, headers: headersRaw })
    }
  }

  if (hasGz) {
    return (req: Request): Response => {
      if (acceptsGzip(req.headers.get('accept-encoding'))) {
        return new Response(gzBody!, { status: 200, headers: headersGz! })
      }
      return new Response(rawBody, { status: 200, headers: headersRaw })
    }
  }

  return (): Response => new Response(rawBody, { status: 200, headers: headersRaw })
}

/**
 * Create a response handler for on-demand files.
 */
function createOnDemandHandler(
  filepath: string,
  mimeType: string,
): (req: Request) => Response {
  const headers = {
    ...SECURITY_HEADERS,
    'Content-Type': mimeType,
    'Cache-Control': 'public, max-age=3600',
  }

  const file = Bun.file(filepath)

  return (): Response => {
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
 * 🔧 已修复内存统计，包含 gzip 副本估算。
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
    console.log(
      `Max total preload: ${(MAX_TOTAL_PRELOAD_BYTES / 1024 / 1024).toFixed(2)} MB`,
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

  // 🔧 修正：使用独立的最大静态文件尺寸
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
      if (!isPathSafe(relativePath)) {
        log.warning(`Skipping suspicious path: ${relativePath}`)
        continue
      }

      const filepath = join(clientDirectory, relativePath)
      const route = `/${relativePath.split(sep).join(posix.sep)}`

      if (!isPathSafe(route)) {
        log.warning(`Skipping suspicious route: ${route}`)
        continue
      }

      try {
        const file = Bun.file(filepath)

        if (file.size === 0) continue

        // 🔧 修复：使用独立的 MAX_STATIC_FILE_SIZE
        if (file.size > MAX_STATIC_FILE_SIZE) {
          log.warning(
            `Skipping oversized file: ${filepath} (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
          )
          continue
        }

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

    candidates.sort((a, b) => a.size - b.size)

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i]
      if (c.shouldPreload) {
        // 🔧 修复：估算内存占用（原始 + gzip 副本约原大小的 0.35）
        const estimatedMemory = c.size + (ENABLE_GZIP ? Math.ceil(c.size * 0.35) : 0)
        if (totalPreloadedBytes + estimatedMemory <= MAX_TOTAL_PRELOAD_BYTES) {
          toPreload.push(c)
          totalPreloadedBytes += estimatedMemory
        } else {
          toOnDemand.push(c)
        }
      } else {
        toOnDemand.push(c)
      }
    }

    // ── Phase 3: Register on-demand routes ─────────────────────────────
    for (let i = 0; i < toOnDemand.length; i++) {
      const c = toOnDemand[i]
      routes[c.route] = createOnDemandHandler(c.filepath, c.type)
      skipped.push({ route: c.route, size: c.size, type: c.type })
    }

    // ── Phase 4: Parallel preload all eligible files ─────────────────────
    // 🔧 修正：使用实际读取后的内存统计
    totalPreloadedBytes = 0

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
        // 🔧 修正：实际占用内存 = raw + gzip 副本
        totalPreloadedBytes += bytes.byteLength + (gz?.byteLength ?? 0)
      }
    }

    // ── Phase 5: Logging ─────────────────────────────────────────────────
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

  let handlerFetch: (request: Request) => Response | Promise<Response>
  try {
    const serverModule = (await import(SERVER_ENTRY_POINT)) as {
      default: { fetch: (request: Request) => Response | Promise<Response> }
    }
    handlerFetch = serverModule.default.fetch
    log.success('TanStack Start application handler initialized')
  } catch (error) {
    log.error(`Failed to load server handler: ${String(error)}`)
    process.exit(1)
  }

  const { routes } = await initializeStaticRoutes(CLIENT_DIRECTORY)

  const error400Headers = { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' }
  const error400Body = 'Bad Request'
  const error500Headers = { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' }
  const error500Body = 'Internal Server Error'

  const optionsHeaders = {
    ...SECURITY_HEADERS,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }

  const server = Bun.serve({
    port: SERVER_PORT,
    development: false,
    reusePort: true,
    maxRequestBodySize: MAX_REQUEST_BODY_SIZE,

    routes: {
      ...routes,

      async '/*'(req: Request) {
        try {
          const method = req.method
          if (method !== 'GET' && method !== 'POST' && method !== 'PUT' && method !== 'DELETE' && method !== 'OPTIONS' && method !== 'HEAD' && method !== 'PATCH') {
            return new Response(error400Body, { status: 400, headers: error400Headers })
          }

          if (method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: optionsHeaders })
          }

          const url = new URL(req.url)
          if (!isPathSafe(url.pathname)) {
            return new Response(error400Body, { status: 400, headers: error400Headers })
          }

          // 安全检查：限制请求头大小
          const headerSize = Array.from(req.headers.entries()).reduce(
            (sum, [k, v]) => sum + k.length + v.length,
            0
          )
          if (headerSize > 8192) {
            return new Response(error400Body, { status: 400, headers: error400Headers })
          }

          return await handlerFetch(req)
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            return new Response(null, { status: 499 })
          }
          return new Response(error500Body, { status: 500, headers: error500Headers })
        }
      },
    },

    error() {
      return new Response(error500Body, { status: 500, headers: error500Headers })
    },
  })

  log.success(`Server listening on http://localhost:${String(server.port)}`)
  log.info(`Process ID: ${process.pid}`)
  log.info(`Memory usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`)

  let isShuttingDown = false

  const shutdown = () => {
    if (isShuttingDown) return
    isShuttingDown = true

    log.info('Shutting down gracefully...')
    server.stop()

    setTimeout(() => {
      process.exit(0)
    }, 1000)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  if (process.env.ENABLE_MEMORY_MONITORING === 'true') {
    const memoryTimer = setInterval(() => {
      const usage = process.memoryUsage()
      const heapUsed = (usage.heapUsed / 1024 / 1024).toFixed(2)
      const heapTotal = (usage.heapTotal / 1024 / 1024).toFixed(2)
      const rss = (usage.rss / 1024 / 1024).toFixed(2)

      log.info(`Memory: Heap ${heapUsed}/${heapTotal} MB, RSS ${rss} MB`)

      if (usage.heapUsed > MAX_TOTAL_PRELOAD_BYTES * 2) {
        log.warning('High memory usage detected')
      }
    }, 60000)
    memoryTimer.unref()
  }

  if (ENABLE_SCHEDULED_GC) {
    log.info(
      `Scheduled GC enabled: interval=${SCHEDULED_GC_INTERVAL_MS}ms` +
        (SCHEDULED_GC_HEAP_THRESHOLD > 0
          ? `, threshold=${(SCHEDULED_GC_HEAP_THRESHOLD / 1024 / 1024).toFixed(2)}MB`
          : ''),
    )

    const gcTimer = setInterval(() => {
      if (SCHEDULED_GC_HEAP_THRESHOLD > 0) {
        const heapUsed = process.memoryUsage().heapUsed
        if (heapUsed < SCHEDULED_GC_HEAP_THRESHOLD) return
      }

      const before = process.memoryUsage().heapUsed
      Bun.gc(true)
      const after = process.memoryUsage().heapUsed
      const freedMB = ((before - after) / 1024 / 1024).toFixed(2)

      if (VERBOSE) {
        log.info(
          `GC: freed ${freedMB} MB (${(before / 1024 / 1024).toFixed(2)} → ${(after / 1024 / 1024).toFixed(2)} MB)`,
        )
      }
    }, SCHEDULED_GC_INTERVAL_MS)
    gcTimer.unref()
  }
}

// ─── Global Safety Net ──────────────────────────────────────────────────────

process.on('unhandledRejection', (reason: unknown) => {
  if (reason instanceof Error && reason.name === 'AbortError') {
    return
  }
  log.error(`Unhandled rejection: ${String(reason)}`)
})

// ─── Entry Point ─────────────────────────────────────────────────────────────

initializeServer().catch((error: unknown) => {
  log.error(`Failed to start server: ${String(error)}`)
  process.exit(1)
})
