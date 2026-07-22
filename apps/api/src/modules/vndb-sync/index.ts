import { betterAuth } from '@api/modules/auth'
import { Elysia } from 'elysia'
import { VndbSync } from './service'

export const vndbSync = new Elysia({ prefix: '/vndb-sync' })
  .use(betterAuth)
  .get(
    '/progress',
    async () => {
      return await VndbSync.getProgress()
    },
    { isAdmin: true },
  )
  .post(
    '/full',
    async () => {
      void VndbSync.syncFull()
      return { ok: true, message: '全量同步已触发' }
    },
    { isAdmin: true },
  )
  .post(
    '/delta',
    async () => {
      void VndbSync.syncDelta()
      return { ok: true, message: '增量同步已触发' }
    },
    { isAdmin: true },
  )
  .post(
    '/producers',
    async () => {
      void VndbSync.syncProducersFromDb()
      return { ok: true, message: '开发者同步已触发' }
    },
    { isAdmin: true },
  )
