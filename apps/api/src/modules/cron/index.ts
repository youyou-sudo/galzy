import { cron, Patterns } from '@elysiajs/cron'
import { Elysia } from 'elysia'
import { CronService } from './service'

export const cronServer = new Elysia()
  .use(
    cron({
      name: 'workerDataPull',
      pattern: Patterns.everyMinutes(1),
      run() {
        CronService.workerDataPull()
      },
    }),
  )
  .use(
    cron({
      name: 'alistSyncScript',
      pattern: Patterns.everyMinutes(5),
      run() {
        CronService.alistSyncScript()
      },
    }),
  )
  .use(
    cron({
      name: 'meiliSearchAddIndex',
      pattern: Patterns.everyHours(12),
      run() {
        CronService.meiliSearchAddIndex()
      },
    }),
  )
  .use(
    cron({
      name: 'meiliSearchAddTag',
      pattern: Patterns.everyHours(12),
      run() {
        CronService.meiliSearchAddTag()
      },
    }),
  )
  .get('/task/meilisearch/game', () => {
    return CronService.meiliSearchAddIndex()
  })
  .get('/task/meilisearch/tag', () => {
    return CronService.meiliSearchAddIndex()
  })
