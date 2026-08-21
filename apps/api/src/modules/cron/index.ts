import { QUEUE } from '@api/libs/queue'
import { betterAuth } from '@api/modules/auth'
import { CronService } from '@api/modules/cron/service'
import { enqueue } from '@api/modules/tasks/service'
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
  .get('/task/meiliSearchAddIndex', async () => {
    console.log('[Cron Trigger] meiliSearchAddIndex 手动触发')
    const jobId = await enqueue(QUEUE.meiliIndex, { type: 'meili-game' })
    return { ok: true, message: '游戏索引重建已入队', jobId }
  })
  .get('/task/meiliSearchAddTag', async () => {
    console.log('[Cron Trigger] meiliSearchAddTag 手动触发')
    const jobId = await enqueue(QUEUE.meiliIndex, { type: 'meili-tag' })
    return { ok: true, message: '标签索引重建已入队', jobId }
  })
  .get('/task/meiliSearchAddProducer', async () => {
    console.log('[Cron Trigger] meiliSearchAddProducer 手动触发')
    const jobId = await enqueue(QUEUE.meiliIndex, { type: 'meili-producer' })
    return { ok: true, message: '厂商索引重建已入队', jobId }
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
  .get('/task/cloudreveSyncScript', async () => {
    console.log('[Cron Trigger] cloudreveSyncScript 手动触发')
    const jobId = await enqueue(QUEUE.cloudreveSync, { type: 'cloudreve-sync' })
    return { ok: true, message: 'Cloudreve 同步已入队', jobId }
  })
