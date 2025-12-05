import swagger from '@elysiajs/swagger'
import { Elysia } from 'elysia'
import { dbSeed, initValidationError } from './libs'
import {
  cronServer,
  download,
  game,
  search,
  startCronTasks,
  tags,
  umami,
  YouyouAuth,
} from './modules'
import { media } from './modules/media'
import { ping } from './modules/ping'
import { strategy } from './modules/strategy'

initValidationError()
dbSeed()
if (process.env.NODE_ENV === 'production') startCronTasks()
const app = new Elysia()
  .onError(({ code, error }) => {
    if (code === 'VALIDATION') return error.message
  })
  .use(process.env.NODE_ENV === 'development' ? swagger() : (app) => app)
  .use(cronServer)
  .use(YouyouAuth)
  .use(umami)
  .use(game)
  .use(tags)
  .use(download)
  .use(search)
  .use(strategy)
  .use(media)
  .use(ping)
  .listen(process.env.API_PORT ?? 3001)

export type APP = typeof app

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
)
