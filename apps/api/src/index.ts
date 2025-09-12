import { Elysia } from 'elysia'

import { dbSeed, initValidationError } from './libs'
import {
  cronServer,
  download,
  game,
  search,
  tags,
  umami,
  YouyouAuth,
} from './modules'
import { media } from './modules/media'
import { strategy } from './modules/strategy'

initValidationError()
dbSeed()
export const app = new Elysia()
  .onError(({ code, error }) => {
    if (code === 'VALIDATION') {
      const errors = Array.from(error.validator.Errors(error.value)).map(
        (e: any) => ({
          field: e.path.replace(/^\//, ''),
          message: e.message,
        }),
      )

      return {
        type: 'validation',
        errors,
      }
    }
  })
  .use(YouyouAuth)
  .use(umami)
  .use(game)
  .use(tags)
  .use(download)
  .use(search)
  .use(strategy)
  .use(media)
  .use(cronServer)
  .listen(process.env.API_PORT ?? 3001)

export type app = typeof app

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
)
