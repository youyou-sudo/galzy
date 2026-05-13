import swagger from '@elysiajs/swagger'
import { Elysia } from 'elysia'
import { dbAction, initValidationError } from './libs'
import {
  cronServer,
  download,
  game,
  media,
  producer,
  search,
  startCronTasks,
  status,
  strategy,
  tags,
  umami,
  YouyouAuth,
} from './modules'
import { setDeployStatus } from './modules/status/service'

setDeployStatus('starting')

console.log(`🦊 Elysia is running loding……`)

initValidationError()
dbAction()
if (process.env.NODE_ENV === 'production') startCronTasks()

const app = new Elysia()
  .onError(({ code, error }) => {
    if (code === 'VALIDATION') return error.message
  })
  .use(process.env.NODE_ENV === 'development' ? swagger() : (app) => app)
  .use(status)
  .use(cronServer)
  .use(YouyouAuth)
  .use(umami)
  .use(game)
  .use(tags)
  .use(download)
  .use(search)
  .use(strategy)
  .use(media)
  .use(producer)
  .listen(process.env.API_PORT ?? 3001)

export type APP = typeof app

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
)
