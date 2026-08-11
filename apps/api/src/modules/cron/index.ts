import { betterAuth } from '@api/modules/auth'
import { CronService } from '@api/modules/cron/service'
import { Cron } from 'croner'
import { Elysia, t } from 'elysia'

export const cronServer = new Elysia()
  .use(betterAuth)
  .get(
    '/task/cloudreveSearch',
    async ({ query }) => {
      return await CronService.cloudreveSearchPreview(query)
    },
    {
      // isAdmin: true,
      query: t.Object({
        keyword: t.Optional(t.String({ default: '[vndb-' })),
        limit: t.Optional(t.Number({ default: 20, minimum: 1, maximum: 200 })),
      }),
    },
  )
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
  .get('/task/cloudreveSyncScript', () => {
    console.log('[Cron Trigger] cloudreveSyncScript 手动触发')
    return CronService.cloudreveSyncScript()
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

  // 每 30 分钟同步一次 Cloudreve 目录 → 文件条目。
  // 文件夹移动/改名后路径自动自愈，新增目录自动上架（搜索+upsert 约数秒，已用分布式锁防重入）
  new Cron('*/30 * * * *', () => {
    CronService.cloudreveSyncScript()
    console.log('[Cron] cloudreveSyncScript 定时执行 (30min)')
  })

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
