import { betterAuth } from '@api/modules/auth'
import { CronService } from '@api/modules/cron/service'
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
  .get(
    '/cloudreve',
    async () => {
      return await VndbSync.cloudreveSyncStatus()
    },
    { isAdmin: true },
  )
  .post(
    '/cloudreve/sync',
    async () => {
      // 同步本身约数秒（搜索+upsert），等待结果返回，让管理页能感知"锁被占用/失败"
      const result = await CronService.cloudreveSyncScript()
      return (
        result ?? {
          ok: false,
          message: '已有 Cloudreve 同步正在运行，请稍后再试',
        }
      )
    },
    { isAdmin: true },
  )
  .post(
    '/cloudreve/check',
    async () => {
      return await CronService.cloudreveSyncCheck()
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
