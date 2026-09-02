import type { TaskPayload } from '@api/libs/queue'
import { betterAuth } from '@api/modules/auth'
import { Elysia } from 'elysia'
import { TasksModel } from './model'
import {
  batchDeleteJobs,
  deleteJob,
  enqueue,
  getJobDetail,
  getJobLogs,
  getQueueStats,
  getTaskStats,
  listDeadLetterJobs,
  listJobs,
  removeDeadLetterJob,
  republishDeadLetterJob,
  retryJob,
} from './service'

/**
 * 任务队列查询/触发接口（管理侧）。
 *
 * - 手动入队（POST /tasks/enqueue/:queue）替代原 cron/vndb-sync 的触发点。
 * - 状态/进度/日志查询替代原 getMeiliProgress / getProgress / addMeiliLog。
 * - 死信管理挂在 /tasks/deadLetter/:queue 前缀下（避开顶层 /tasks/:jobId 动态段，
 *   避免 /tasks/deadLetter/... 被 :jobId 影子化）。
 * - 统计（stats / queues）与运维操作（retry / delete / batchDelete）。
 */
export const tasks = new Elysia({ prefix: '/tasks' })
  .use(betterAuth)
  // ── 统计 ──
  .get('/stats', async () => getTaskStats(), { isAdmin: true })
  .get('/queues', async () => getQueueStats(), { isAdmin: true })
  // ── 死信管理（静态前缀在 Elysia 树中优先于 :jobId 动态段）──
  .get(
    '/deadLetter/:queue',
    async ({ params: { queue }, query }) =>
      listDeadLetterJobs(queue, query.pageSize, query.pageIndex),
    {
      isAdmin: true,
      params: TasksModel.queueParam,
      query: TasksModel.logsQuery,
    },
  )
  .post(
    '/deadLetter/:queue/republish',
    async ({ params: { queue }, body }) =>
      republishDeadLetterJob(queue, body.jobId),
    {
      isAdmin: true,
      params: TasksModel.queueParam,
      body: TasksModel.deadLetterJobBody,
    },
  )
  .post(
    '/deadLetter/:queue/remove',
    async ({ params: { queue }, body }) =>
      removeDeadLetterJob(queue, body.jobId),
    {
      isAdmin: true,
      params: TasksModel.queueParam,
      body: TasksModel.deadLetterJobBody,
    },
  )
  // ── 任务列表 / 详情 / 日志 / 入队 / 运维 ──
  .get('/', async ({ query }) => listJobs(query), {
    isAdmin: true,
    query: TasksModel.listQuery,
  })
  .get('/:jobId', async ({ params: { jobId } }) => getJobDetail(jobId), {
    isAdmin: true,
  })
  .get(
    '/:jobId/logs',
    async ({ params: { jobId }, query }) =>
      getJobLogs(jobId, query.pageSize, query.pageIndex),
    { isAdmin: true, query: TasksModel.logsQuery },
  )
  .post(
    '/enqueue/:queue',
    async ({ params: { queue }, body }) => {
      // queue→type 白名单校验在 service.enqueue 内做（抛 400）。
      const jobId = await enqueue(queue, body as TaskPayload)
      return { ok: true, jobId }
    },
    {
      isAdmin: true,
      params: TasksModel.queueParam,
      body: TasksModel.enqueueBody,
    },
  )
  .post('/batchDelete', async ({ body }) => batchDeleteJobs(body.ids), {
    isAdmin: true,
    body: TasksModel.batchDeleteBody,
  })
  .post('/:jobId/retry', async ({ params: { jobId } }) => retryJob(jobId), {
    isAdmin: true,
  })
  .post('/:jobId/delete', async ({ params: { jobId } }) => deleteJob(jobId), {
    isAdmin: true,
  })
