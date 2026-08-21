import { QUEUE } from '@api/libs/queue'
import { betterAuth } from '@api/modules/auth'
import { enqueue } from '@api/modules/tasks/service'
import { Elysia } from 'elysia'
import { KungalSync } from './service'

export const kungalSync = new Elysia({ prefix: '/kungal-sync' })
  .use(betterAuth)
  .get(
    '/progress',
    async () => {
      return await KungalSync.getProgress()
    },
    { isAdmin: true },
  )
  .post(
    '/full',
    async () => {
      const jobId = await enqueue(QUEUE.kungalSync, { type: 'kungal-full' })
      return { ok: true, message: 'Kungal 全量同步已入队', jobId }
    },
    { isAdmin: true },
  )
  .post(
    '/delta',
    async () => {
      const jobId = await enqueue(QUEUE.kungalSync, { type: 'kungal-delta' })
      return { ok: true, message: 'Kungal 增量同步已入队', jobId }
    },
    { isAdmin: true },
  )
