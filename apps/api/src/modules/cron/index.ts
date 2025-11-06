import { Cron } from 'croner'
import { Elysia } from 'elysia'
import { CronService } from './service'

export const cronServer = new Elysia()
  .get('/task/meiliSearchAddIndex', () => {
    console.log('[Cron Trigger] meiliSearchAddIndex 手动触发')
    return CronService.meiliSearchAddIndex()
  })
  .get('/task/meiliSearchAddTag', () => {
    console.log('[Cron Trigger] meiliSearchAddTag 手动触发')
    return CronService.meiliSearchAddTag()
  })
  .get('/task/alistSyncScript', () => {
    console.log('[Cron Trigger] alistSyncScript 手动触发')
    return CronService.alistSyncScript()
  })
  .get('/task/workerDataPull', () => {
    console.log('[Cron Trigger] workerDataPull 手动触发')
    return CronService.workerDataPull()
  })


export function startCronTasks() {
  // 每分钟执行一次
  new Cron('*/1 * * * *', () => {
    CronService.workerDataPull()
    console.log('[Cron] workerDataPull 定时执行')
  })

  // 每5分钟执行一次
  new Cron('*/5 * * * *', () => {
    CronService.alistSyncScript()
    console.log('[Cron] alistSyncScript 定时执行')
  })

  // 每12小时执行一次
  new Cron('0 */12 * * *', () => {
    CronService.meiliSearchAddIndex()
    console.log('[Cron] meiliSearchAddIndex 定时执行')
  })

  // 每12小时执行一次
  new Cron('0 */12 * * *', () => {
    CronService.meiliSearchAddTag()
    console.log('[Cron] meiliSearchAddTag 定时执行')
  })

  console.log('Cron tasks started.')
}
