import { dbAction, initValidationError } from '@api/libs'
import {
  betterAuth,
  collections,
  comments,
  cronServer,
  download,
  game,
  health,
  media,
  otel,
  producer,
  search,
  startCronTasks,
  status,
  strategy,
  tags,
  topics,
  views,
  vndbSync,
} from '@api/modules'
import { OpenAPI } from '@api/modules/auth/service'
import { setDeployStatus } from '@api/modules/status/service'
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
      // Log unexpected errors for diagnostics
      if (code !== 'NOT_FOUND') {
        console.error(
          `[err] ${code ?? 'UNKNOWN'}:`,
          error instanceof Error ? error.message : error,
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
    .use(vndbSync)
}

export type app = Awaited<ReturnType<typeof buildApp>>

async function startServer() {
  setDeployStatus('starting')

  console.log(`🦊 Elysia is running loding……`)

  initValidationError()
  dbAction()
  if (process.env.NODE_ENV === 'production') startCronTasks()

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
