import { dbAction, initValidationError } from '@api/libs'
import {
  betterAuth,
  comments,
  cronServer,
  download,
  game,
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

setDeployStatus('starting')

console.log(`🦊 Elysia is running loding……`)

initValidationError()
dbAction()
if (process.env.NODE_ENV === 'production') startCronTasks()

export const app = new Elysia()
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
  .use(otel)
  .use(game)
  .use(comments)
  .use(status)
  .use(cronServer)
  .use(umami)
  .use(tags)
  .use(download)
  .use(search)
  .use(strategy)
  .use(media)
  .use(producer)
  .listen(Bun.env.PORT ?? 3001)

process.on('beforeExit', app.stop)

export type app = typeof app

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
)
