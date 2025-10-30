import { cron, Patterns } from '@elysiajs/cron'
import { Elysia } from 'elysia'
import { CronService } from './service'

export const cronServer = new Elysia()
  // .use(
  //   cron({
  //     name: 'workerDataPull',
  //     pattern: Patterns.everyMinutes(1),
  //     run() {
  //       CronService.workerDataPull()
  //       console.log('workerDataPull')
  //     },
  //   })
  // )
  // .use(
  //   cron({
  //     name: 'alistSyncScript',
  //     pattern: Patterns.everyMinutes(5),
  //     run() {
  //       CronService.alistSyncScript()
  //       console.log('alistSyncScript')
  //     },
  //   })
  // )
  // .use(
  //   cron({
  //     name: 'meiliSearchAddIndex',
  //     pattern: Patterns.everyHours(12),
  //     run() {
  //       CronService.meiliSearchAddIndex()
  //       console.log('meiliSearchAddIndex')
  //     },
  //   })
  // )
  // .use(
  //   cron({
  //     name: 'meiliSearchAddTag',
  //     pattern: Patterns.everyHours(12),
  //     run() {
  //       CronService.meiliSearchAddTag()
  //       console.log('meiliSearchAddTag')
  //     },
  //   })
  // )
  .get('/task/meiliSearchAddIndex', () => CronService.meiliSearchAddIndex())
  .get('/task/meiliSearchAddTag', () => CronService.meiliSearchAddTag())
  .get('/task/alistSyncScript', () => CronService.alistSyncScript())
  .get('/task/workerDataPull', () => CronService.workerDataPull())
