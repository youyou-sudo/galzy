import { startDbWatchdog } from '@api/db/watchdog'
import { dbAction, initValidationError } from '@api/libs'
import {
  betterAuth,
  collections,
  comments,
  cronServer,
  download,
  game,
  health,
  kungalSync,
  media,
  otel,
  producer,
  search,
  status,
  strategy,
  tags,
  tasks,
  topics,
  views,
  vndbSync,
} from '@api/modules'
import { OpenAPI } from '@api/modules/auth/service'
import { setDeployStatus } from '@api/modules/status/service'
import { startQueueWorkers } from '@api/modules/tasks/service'
import { openapi } from '@elysia/openapi'
import { Elysia } from 'elysia'

async function buildApp() {
  return new Elysia({
    serve: {
      // Prevent hanging connections from blocking the event loop
      idleTimeout: 30,
    },
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
    .use(game)
    .use(collections)
    .use(comments)
    .use(cronServer)
    .use(views)
    .use(tags)
    .use(download)
    .use(search)
    .use(strategy)
    .use(media)
    .use(producer)
    .use(status)
    .use(topics)
    .use(tasks)
    .use(vndbSync)
    .use(kungalSync)
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
    await startQueueWorkers()
    // bun:sql 池卡死自动恢复：独立探针确认 DB 健康而池失败时退出进程，
    // 由编排层重启（oven-sh/bun#30494 上游未修复，见 db/watchdog.ts）。
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
