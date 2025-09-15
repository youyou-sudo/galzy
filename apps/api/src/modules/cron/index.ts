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
        console.log('workerDataPull')
      },
    }),
  )
  .use(
    cron({
      name: 'alistSyncScript',
      pattern: Patterns.everyMinutes(5),
      run() {
        CronService.alistSyncScript()
        console.log('alistSyncScript')
      },
    }),
  )
  .use(
    cron({
      name: 'meiliSearchAddIndex',
      pattern: Patterns.everyHours(12),
      run() {
        CronService.meiliSearchAddIndex()
        console.log('meiliSearchAddIndex')
      },
    }),
  )
  .use(
    cron({
      name: 'meiliSearchAddTag',
      pattern: Patterns.everyHours(12),
      run() {
        CronService.meiliSearchAddTag()
        console.log('meiliSearchAddTag')
      },
    }),
  )
  .get('/task/meiliSearchAddIndex', () => {
    console.log('meiliSearchAddIndex')
    return CronService.meiliSearchAddIndex()
  })
  .get('/task/meiliSearchAddTag', () => {
    console.log('meiliSearchAddTag')
    return CronService.meiliSearchAddTag()
  })

  .get('/task/alistSyncScript', () => {
    console.log('alistSyncScript')
    return CronService.alistSyncScript()
  })
  .get('/task/workerDataPull', () => {
    console.log('workerDataPull')
    return CronService.workerDataPull()
  })
