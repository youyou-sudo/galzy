import { startDbWatchdog } from '@api/db/watchdog'
import { dbAction, initValidationError } from '@api/libs'
import {
  invalidateAfterMutation,
  isMutatingRequest,
} from '@api/libs/cdn-invalidation'
import {
  adverts,
  betterAuth,
  characters,
  collections,
  comments,
  cronServer,
  download,
  friendLinks,
  game,
  health,
  kungalSync,
  media,
  producer,
  search,
  status,
  tags,
  tasks,
  topics,
  views,
  vndbSync,
  walkthroughs,
} from '@api/modules'
import { OpenAPI } from '@api/modules/auth/service'
import { setDeployStatus } from '@api/modules/status/service'
import { startQueueWorkers } from '@api/modules/tasks/service'
import { openapi } from '@elysia/openapi'
import { Elysia } from 'elysia'

async function buildApp() {
  return (
    new Elysia({
      serve: {
        // Prevent hanging connections from blocking the event loop
        idleTimeout: 30,
      },
    })
      /**
       * 公开页面由 CDN 边缘缓存（源站 SSR 不缓存）：写操作成功后主动清掉相关
       * URL，否则最长要等一个 s-maxage 周期才能看到新数据。这里按路由前缀兜底，
       * 精确 id 的清理由各 service 调 libs/cloudflare-cache 的语义 helper。
       */
      .onAfterHandle(({ request, set }) => {
        if (!isMutatingRequest(request.method)) return
        const status = Number(set.status ?? 200)
        if (Number.isInteger(status) && status >= 400) return
        void invalidateAfterMutation(new URL(request.url).pathname)
      })
      .onError(({ code, error, set }) => {
        if (code === 'VALIDATION') {
          set.status = 400
          return error.message
        }
        // 4xx 业务错误（未找到、参数错误等）是正常业务流，不按服务端错误记录；
        // 只有 5xx 才需要 error 级日志用于排查。
        const statusCode = typeof code === 'number' ? code : Number(code)
        const is4xx =
          Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500
        if (is4xx || code === 'NOT_FOUND') return
        const msg = error instanceof Error ? error.message : error
        const cause = error instanceof Error ? (error as any).cause : undefined
        console.error(`[err] ${code ?? 'UNKNOWN'}:`, msg)
        if (cause) {
          console.error(
            `[err]   caused by:`,
            cause instanceof Error ? cause.message : cause,
          )
        }
      })
      .use(
        openapi({
          documentation: {
            components: await OpenAPI.components,
            paths: await OpenAPI.getPaths(),
          },
        }),
      )
      .use(betterAuth)
      .use(health)
      .use(adverts)
      .use(characters)
      .use(game)
      .use(collections)
      .use(comments)
      .use(cronServer)
      .use(views)
      .use(tags)
      .use(download)
      .use(friendLinks)
      .use(search)
      .use(media)
      .use(producer)
      .use(status)
      .use(topics)
      .use(tasks)
      .use(vndbSync)
      .use(kungalSync)
      .use(walkthroughs)
  )
}

export type app = Awaited<ReturnType<typeof buildApp>>

async function startServer() {
  setDeployStatus('starting')

  console.log(`🦊 Elysia is running loding……`)

  initValidationError()
  // 先等 DB 连通 + 挂起迁移应用完成，再启动 cron 与看门狗：全新数据库部署时表尚不存在，
  // 过早启动的定时任务会每分钟报 relation does not exist（如 workerDataPull 查 galrc_cloudflare）。
  const dbReady = await dbAction()
  if (process.env.NODE_ENV === 'production' && dbReady) {
    // 任务队列 Worker + 定时调度（已替代 croner，见 docs/task-queue-migration.md）。
    // 这里刻意只对 production 生效：本机 dev 的 .env 里 REDIS_ENABLED=true 且指向共享
    // 生产 Redis，若本地也起 Worker，就会去抢线上队列里的任务（并改写生产库状态）。
    // 代价是 dev 没有消费方——由 tasks/service.ts 的 enqueue 内联执行兜住，见文档 §11。
    await startQueueWorkers()
    // bun:sql 池卡死自动恢复：独立探针确认 DB 健康而池失败时退出进程，
    // 由编排层重启。上游 oven-sh/bun#30494 仍未关闭（1.4.x 已修一批同类问题，
    // 余项与本地压测结论见 db/watchdog.ts、db/client.ts 的池上限注释）。
    startDbWatchdog()
  }

  const app = (await buildApp()).listen(Number(process.env.PORT) || 3001)

  process.on('beforeExit', app.stop)

  console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
  )
}

async function healthcheck() {
  const port = Number(process.env.PORT) || 3001
  const url = `http://localhost:${port}/health`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) {
      console.error(`[err] Healthcheck failed: ${res.status} ${res.statusText}`)
      process.exit(1)
    }
    const body = (await res.json()) as { ok?: boolean }
    if (body.ok !== true) {
      console.error('[err] Healthcheck failed: unexpected response body')
      process.exit(1)
    }
    console.log('[ ok ] Healthcheck passed')
    process.exit(0)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[err] Healthcheck failed:', msg)
  }
}

const command = process.argv[2]
if (command === 'healthcheck') {
  healthcheck()
} else {
  startServer().catch((e) => {
    console.error('[err] Failed to start:', e)
    process.exit(1)
  })
}
