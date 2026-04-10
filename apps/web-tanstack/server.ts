import path from 'node:path'

const PORT = Number(process.env.PORT ?? 3000)
const CLIENT_DIR = './dist/client'
const SERVER_ENTRY = './dist/server/server.js'

const MAX_PRELOAD = Number(process.env.ASSET_PRELOAD_MAX_SIZE ?? 5 * 1024 * 1024)
const ENABLE_ETAG = (process.env.ASSET_PRELOAD_ENABLE_ETAG ?? 'true') === 'true'

/**
 * Header 模板（减少 GC）
 */
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'
const NORMAL_CACHE = 'public, max-age=3600'

/**
 * 内存缓存结构（零拷贝）
 */
interface Asset {
  raw: Bun.BunFile
  gzip?: Bun.BunFile
  brotli?: Bun.BunFile
  etag?: string
  lastModified?: string
  type: string
  immutable: boolean
  size: number
}

const staticMap = new Map<string, Asset>()

/**
 * 轻量 ETag
 */
function createEtag(size: number, mtime: number) {
  return `W/"${size}-${mtime}"`
}

/**
 * 是否应该 preload（类型 + size）
 */
function shouldPreload(type: string, size: number) {
  if (size > MAX_PRELOAD) return false

  return (
    type.includes('javascript') ||
    type.includes('css') ||
    type.includes('html') ||
    type.includes('json')
  )
}

/**
 * 是否 immutable（基于 hash 文件名）
 */
function isImmutable(filename: string) {
  return /\.[a-f0-9]{8,}\./.test(filename)
}

/**
 * 加载静态资源
 */
async function loadAssets() {
  let total = 0
  const glob = new Bun.Glob('**/*')

  for await (const rel of glob.scan({ cwd: CLIENT_DIR })) {
    const filepath = path.join(CLIENT_DIR, rel)
    const route = '/' + rel.split(path.sep).join('/')

    const file = Bun.file(filepath)
    const stat = await file.stat()
    if (!stat || stat.size === 0) continue

    const type = file.type || 'application/octet-stream'
    const immutable = isImmutable(rel)

    const asset: Asset = {
      raw: file,
      type,
      size: stat.size,
      immutable,
    }

    // ETag
    if (ENABLE_ETAG) {
      asset.etag = createEtag(stat.size, stat.mtimeMs)
    }

    // Last-Modified（更便宜的缓存验证）
    asset.lastModified = new Date(stat.mtimeMs).toUTCString()

    // preload 小文件（只存引用，不读内存）
    if (shouldPreload(type, stat.size)) {
      const gz = Bun.file(filepath + '.gz')
      const br = Bun.file(filepath + '.br')

      if (await br.exists()) asset.brotli = br
      else if (await gz.exists()) asset.gzip = gz

      total += stat.size
    }

    staticMap.set(route, asset)
  }

  console.log(`[static] loaded ${staticMap.size} files`)
  console.log(`[static] memory ~ ${(total / 1024 / 1024).toFixed(2)} MB (zero-copy)`)
}

/**
 * 静态资源处理（高性能路径）
 */
function serveStatic(req: Request): Response | undefined {
  // 避免 new URL（热路径优化）
  const pathname = req.url.split('?', 1)[0]

  const asset = staticMap.get(pathname)
  if (!asset) return

  const headers: Record<string, string> = {
    'Content-Type': asset.type,
    'Cache-Control': asset.immutable ? IMMUTABLE_CACHE : NORMAL_CACHE,
  }

  // ETag
  if (asset.etag) {
    const ifNone = req.headers.get('if-none-match')
    if (ifNone === asset.etag) {
      return new Response(null, {
        status: 304,
        headers: { ETag: asset.etag },
      })
    }
    headers.ETag = asset.etag
  }

  // Last-Modified
  if (asset.lastModified) {
    const ifModifiedSince = req.headers.get('if-modified-since')
    if (ifModifiedSince === asset.lastModified) {
      return new Response(null, { status: 304 })
    }
    headers['Last-Modified'] = asset.lastModified
  }

  const ae = req.headers.get('accept-encoding')

  const hasBr = ae && ae.indexOf('br') !== -1
  const hasGzip = ae && ae.indexOf('gzip') !== -1

  // Brotli 优先
  if (asset.brotli && hasBr) {
    headers['Content-Encoding'] = 'br'
    return new Response(asset.brotli, { headers })
  }

  if (asset.gzip && hasGzip) {
    headers['Content-Encoding'] = 'gzip'
    return new Response(asset.gzip, { headers })
  }

  return new Response(asset.raw, { headers })
}

/**
 * 启动
 */
async function start() {
  const app = (await import(SERVER_ENTRY)).default

  await loadAssets()

  Bun.serve({
    port: PORT,

    fetch(req) {
      try {
        const res = serveStatic(req)
        if (res) return res

        return app.fetch(req)
      } catch (e) {
        console.error(e)
        return new Response('Internal Server Error', { status: 500 })
      }
    },

    error(e) {
      console.error(e)
      return new Response('Internal Server Error', { status: 500 })
    },
  })

  console.log(`server running at http://localhost:${PORT}`)
}

start()
