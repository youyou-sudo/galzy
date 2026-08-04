import { CronService } from '@api/modules/cron/service'
import { Cron } from 'croner'
import { Elysia, t } from 'elysia'

export const cronServer = new Elysia()
  .get('/task/meiliSearchAddIndex', () => {
    console.log('[Cron Trigger] meiliSearchAddIndex 手动触发')
    void CronService.meiliSearchAddIndex()
    return { ok: true, message: '游戏索引重建已触发' }
  })
  .get('/task/meiliSearchAddTag', () => {
    console.log('[Cron Trigger] meiliSearchAddTag 手动触发')
    void CronService.meiliSearchAddTag()
    return { ok: true, message: '标签索引重建已触发' }
  })
  .get('/task/meiliSearchAddProducer', () => {
    console.log('[Cron Trigger] meiliSearchAddProducer 手动触发')
    void CronService.meiliSearchAddProducer()
    return { ok: true, message: '厂商索引重建已触发' }
  })
  .get(
    '/task/meiliSearchProgress',
    async ({ query: { type } }) => {
      return await CronService.getMeiliProgress(
        type as 'game' | 'tag' | 'producer',
      )
    },
    {
      query: t.Object({
        type: t.String(),
      }),
    },
  )
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

  // // 每5分钟执行一次
  // new Cron('*/5 * * * *', () => {
  //   CronService.alistSyncScript()
  //   console.log('[Cron] alistSyncScript 定时执行')
  // })

  // Weekly full rebuild as safety net (Sunday 3:00 AM)
  new Cron('0 3 * * 0', () => {
    CronService.meiliSearchAddIndex()
    console.log('[Cron] meiliSearchAddIndex weekly full rebuild')
  })

  // Weekly full rebuild as safety net
  new Cron('0 3 * * 0', () => {
    CronService.meiliSearchAddTag()
    console.log('[Cron] meiliSearchAddTag weekly full rebuild')
  })

  // Weekly full rebuild as safety net
  new Cron('0 3 * * 0', () => {
    CronService.meiliSearchAddProducer()
    console.log('[Cron] meiliSearchAddProducer weekly full rebuild')
  })

  console.log('✅️ Cron tasks started.')
}
