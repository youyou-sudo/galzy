import { join } from 'node:path'

// ─── Config ─────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3000)
const CLIENT_DIR = './dist/client'
const SERVER_ENTRY = './dist/server/server.js'

// ─── Static storage（极限结构）────────────────────

type Handler = (req: Request) => Response

const staticMap: Record<string, Handler> = Object.create(null)

// ─── Utils（零开销版本）───────────────────────────

function fastPath(url: string): string {
  const i = url.indexOf('/', 8)
  return i === -1 ? '/' : url.slice(i)
}

// ─── Static Loader（支持 br/gzip）─────────────────

async function loadStatic() {
  const glob = new Bun.Glob('**/*')

  const files: string[] = []
  for await (const f of glob.scan({ cwd: CLIENT_DIR })) {
    files.push(f)
  }

  await Promise.all(
    files.map(async (relativePath) => {
      const filepath = join(CLIENT_DIR, relativePath)

      const file = Bun.file(filepath)
      if (file.size === 0) return

      const route = '/' + relativePath.replaceAll('\\', '/')
      const mime = file.type || 'application/octet-stream'

      // 预读取
      const raw = new Uint8Array(await file.arrayBuffer())

      // 预压缩文件（优先 .br）
      const brFile = Bun.file(filepath + '.br')
      const gzFile = Bun.file(filepath + '.gz')

      const br =
        brFile.size > 0 ? new Uint8Array(await brFile.arrayBuffer()) : undefined
      const gz =
        gzFile.size > 0 ? new Uint8Array(await gzFile.arrayBuffer()) : undefined

      const etag = `W/"${Bun.hash(raw).toString(16)}-${raw.length}"`

      const headersRaw = {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': String(raw.length),
        ETag: etag,
      }

      const headersBr = br && {
        'Content-Type': mime,
        'Content-Encoding': 'br',
        'Cache-Control': headersRaw['Cache-Control'],
        'Content-Length': String(br.length),
        ETag: etag,
        Vary: 'Accept-Encoding',
      }

      const headersGz = gz && {
        'Content-Type': mime,
        'Content-Encoding': 'gzip',
        'Cache-Control': headersRaw['Cache-Control'],
        'Content-Length': String(gz.length),
        ETag: etag,
        Vary: 'Accept-Encoding',
      }

      // 极限 handler（无对象捕获）
      staticMap[route] = (req: Request): Response => {
        const h = req.headers

        if (h.get('if-none-match') === etag) {
          return new Response(null, { status: 304 })
        }

        const ae = h.get('accept-encoding')

        if (ae) {
          if (br && ae.includes('br')) {
            return new Response(br, { headers: headersBr! })
          }
          if (gz && ae.includes('gzip')) {
            return new Response(gz, { headers: headersGz! })
          }
        }

        return new Response(raw, { headers: headersRaw })
      }
    }),
  )

  console.log(`Loaded ${Object.keys(staticMap).length} static routes`)
}

// ─── SSR ─────────────────────────────────────────

let ssrFetch: (req: Request) => Response | Promise<Response>

async function loadSSR() {
  const mod = await import(SERVER_ENTRY)
  ssrFetch = mod.default.fetch
}

// ─── Server ─────────────────────────────────────

async function main() {
  await loadStatic()
  await loadSSR()

  Bun.serve({
    port: PORT,
    reusePort: true,

    fetch(req) {
      const path = fastPath(req.url)

      const handler = staticMap[path]
      if (handler) return handler(req)

      return ssrFetch(req)
    },
  })

  console.log(`Ultra server running on ${PORT}`)
}

main()
