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
import { strategy } from './modules/strategy'
import { ping } from './modules/ping'

initValidationError()
dbSeed()
startCronTasks()
const app = new Elysia()
  .onError(({ code, error }) => {
    if (code === 'VALIDATION')
      return error.message
  })
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
