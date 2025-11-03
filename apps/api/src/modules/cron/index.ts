import { Cron } from 'croner'
import { Elysia } from 'elysia'
import { CronService } from './service'

export const cronServer = new Elysia()
  .get('/task/meiliSearchAddIndex', () => CronService.meiliSearchAddIndex())
  .get('/task/meiliSearchAddTag', () => CronService.meiliSearchAddTag())
  .get('/task/alistSyncScript', () => CronService.alistSyncScript())
  .get('/task/workerDataPull', () => CronService.workerDataPull())


export function startCronTasks() {
  // 每分钟执行一次
  new Cron('*/1 * * * *', () => {
    CronService.workerDataPull()
    console.log('workerDataPull')
  })

  // 每5分钟执行一次
  new Cron('*/5 * * * *', () => {
    CronService.alistSyncScript()
    console.log('alistSyncScript')
  })

  // 每12小时执行一次
  new Cron('0 */12 * * *', () => {
    CronService.meiliSearchAddIndex()
    console.log('meiliSearchAddIndex')
  })

  // 每12小时执行一次
  new Cron('0 */12 * * *', () => {
    CronService.meiliSearchAddTag()
    console.log('meiliSearchAddTag')
  })

  console.log('Cron tasks started.')
}
