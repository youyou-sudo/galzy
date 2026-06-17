import { dbAction, initValidationError } from '@api/libs'
import {
  betterAuth,
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
  umami,
} from '@api/modules'
import { OpenAPI } from '@api/modules/auth/service'
import { setDeployStatus } from '@api/modules/status/service'
import { openapi } from '@elysia/openapi'
import { Elysia } from 'elysia'

async function buildApp() {
  return new Elysia()
    .onError(({ code, error }) => {
      if (code === 'VALIDATION') return error.message
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
    .use(comments)
    .use(cronServer)
    .use(umami)
    .use(tags)
    .use(download)
    .use(search)
    .use(strategy)
    .use(media)
    .use(producer)
    .use(status)
}

export type app = Awaited<ReturnType<typeof buildApp>>

async function startServer() {
  setDeployStatus('starting')

  console.log(`🦊 Elysia is running loding……`)

  initValidationError()
  dbAction()
  if (process.env.NODE_ENV === 'production') startCronTasks()

  const app = (await buildApp()).listen(Bun.env.PORT ?? 3001)

  process.on('beforeExit', app.stop)

  console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
  )
}

async function healthcheck() {
  const port = Number(Bun.env.PORT ?? 3001)
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
    console.error('[err] Healthcheck failed:', (e as Error).message)
    process.exit(1)
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
