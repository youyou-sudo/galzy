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
  // 角色入库单独入口：角色资料只在 kungal 侧（vndb 只做作品锚点），
  // 全量重刷角色不该连带重刷整轮作品同步。
  .post(
    '/characters',
    async () => {
      const jobId = await enqueue(QUEUE.kungalSync, {
        type: 'kungal-characters',
      })
      return { ok: true, message: 'Kungal 角色同步已入队', jobId }
    },
    { isAdmin: true },
  )
  // 攻略入库单独入口：同作品/角色一样是「附加数据」，重刷攻略不该连带重刷作品。
  // 攻略阶段会自己按 upstream_updated_at 跳过没变的行，所以重复触发很便宜。
  .post(
    '/walkthroughs',
    async () => {
      const jobId = await enqueue(QUEUE.kungalSync, {
        type: 'kungal-walkthroughs',
      })
      return { ok: true, message: 'Kungal 攻略同步已入队', jobId }
    },
    { isAdmin: true },
  )
