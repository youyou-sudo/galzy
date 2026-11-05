import { QUEUE } from '@api/libs/queue'
import type { TaskPayload } from '@api/libs/queue/payload'
import { betterAuth } from '@api/modules/auth'
import { enqueue } from '@api/modules/tasks/service'
import { Elysia } from 'elysia'
import { KungalSync } from './service'

/**
 * 四个入口（full / delta / characters / walkthroughs）只是队列消息不同，
 * 响应形状完全一致 —— 收敛成一处，新增阶段时只加一行注册，不会再抄一遍
 * 响应体（抄错的典型症状：前端读到 undefined 的 jobId）。
 */
function enqueueKungal(type: TaskPayload['type'], label: string) {
  return async () => {
    const jobId = await enqueue(QUEUE.kungalSync, { type } as TaskPayload)
    return { ok: true, message: `Kungal ${label}已入队`, jobId }
  }
}

export const kungalSync = new Elysia({ prefix: '/kungal-sync' })
  .use(betterAuth)
  // 读进度走 getProgressForUi：它会先收尾「进程已被 kill、status 还停在 running」
  // 的假运行中记录，否则管理页会永远转圈（写路径不走它，避免每次写都做对账）。
  .get('/progress', async () => await KungalSync.getProgressForUi(), {
    isAdmin: true,
  })
  .post('/full', enqueueKungal('kungal-full', '全量同步'), { isAdmin: true })
  .post('/delta', enqueueKungal('kungal-delta', '增量同步'), { isAdmin: true })
  // 角色入库单独入口：角色资料只在 kungal 侧（vndb 只做作品锚点），
  // 全量重刷角色不该连带重刷整轮作品同步。
  .post('/characters', enqueueKungal('kungal-characters', '角色同步'), {
    isAdmin: true,
  })
  // 攻略入库单独入口：同作品/角色一样是「附加数据」，重刷攻略不该连带重刷作品。
  // 攻略阶段会自己按 upstream_updated_at 跳过没变的行，所以重复触发很便宜。
  .post('/walkthroughs', enqueueKungal('kungal-walkthroughs', '攻略同步'), {
    isAdmin: true,
  })
