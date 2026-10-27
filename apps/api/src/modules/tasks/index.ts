import type { TaskPayload } from '@api/libs/queue'
import { betterAuth } from '@api/modules/auth'
import { Elysia } from 'elysia'
import { TasksModel } from './model'
import {
  batchDeleteJobs,
  batchRemoveDeadLetterJobs,
  batchRepublishDeadLetterJobs,
  batchRetryJobs,
  deleteJob,
  enqueue,
  getJobDetail,
  getJobLogs,
  getQueueStats,
  getTaskMeta,
  getTaskStats,
  listDeadLetterJobs,
  listJobsV2,
  removeDeadLetterJob,
  republishDeadLetterJob,
  retryJob,
} from './service'

/**
 * 任务队列查询/触发接口（管理侧）。
 *
 * - 手动入队（POST /tasks/enqueue/:queue）替代原 cron/vndb-sync 的触发点。
 * - 状态/进度/日志查询替代原 getMeiliProgress / getProgress / addMeiliLog。
 * - 列表查询 V2：多值筛选 / 关键字 / 时间区间 / 逾期 / 排序白名单 / 分面计数。
 * - 死信管理挂在 /tasks/deadLetter/:queue 前缀下（避开顶层 /tasks/:jobId 动态段，
 *   避免 /tasks/deadLetter/... 被 :jobId 影子化）。
 * - 写操作有门控：非终态不可删（除非 force）；同 queue+type 已有活跃任务时重试 409。
 * - 批量接口一律 HTTP 200 + 逐项结果（部分失败不整体回滚）。
 */
export const tasks = new Elysia({ prefix: '/tasks' })
  .use(betterAuth)
  // ── 统计 / 字典 ──
  .get('/stats', async () => getTaskStats(), { isAdmin: true })
  .get('/queues', async () => getQueueStats(), { isAdmin: true })
  .get('/meta', async () => getTaskMeta(), { isAdmin: true })
  // ── 死信管理（静态前缀在 Elysia 树中优先于 :jobId 动态段）──
  .get(
    '/deadLetter/:queue',
    async ({ params: { queue }, query }) =>
      listDeadLetterJobs(queue, query.pageSize, query.pageIndex),
    {
      isAdmin: true,
      params: TasksModel.queueParam,
      query: TasksModel.deadLetterQuery,
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
  .post(
    '/deadLetter/:queue/batchRepublish',
    async ({ params: { queue }, body }) =>
      batchRepublishDeadLetterJobs(queue, body.jobIds),
    {
      isAdmin: true,
      params: TasksModel.queueParam,
      body: TasksModel.deadLetterBatchBody,
    },
  )
  .post(
    '/deadLetter/:queue/batchRemove',
    async ({ params: { queue }, body }) =>
      batchRemoveDeadLetterJobs(queue, body.jobIds),
    {
      isAdmin: true,
      params: TasksModel.queueParam,
      body: TasksModel.deadLetterBatchBody,
    },
  )
  // ── 列表 / 批量 / 详情 / 日志 / 入队 / 运维 ──
  .get('/', async ({ query }) => listJobsV2(query), {
    isAdmin: true,
    query: TasksModel.listQuery,
  })
  .post('/batchDelete', async ({ body }) => batchDeleteJobs(body.ids), {
    isAdmin: true,
    body: TasksModel.batchDeleteBody,
  })
  .post('/batchRetry', async ({ body }) => batchRetryJobs(body.ids), {
    isAdmin: true,
    body: TasksModel.batchRetryBody,
  })
  .get('/:jobId', async ({ params: { jobId } }) => getJobDetail(jobId), {
    isAdmin: true,
  })
  .get(
    '/:jobId/logs',
    async ({ params: { jobId }, query }) => getJobLogs(jobId, query),
    { isAdmin: true, query: TasksModel.logsQuery },
  )
  .post(
    '/enqueue/:queue',
    async ({ params: { queue }, body }) => {
      // queue→type 白名单校验在 service.enqueue 内做（抛 400 INVALID_TASK）。
      const jobId = await enqueue(queue, body as TaskPayload)
      return { ok: true, jobId }
    },
    {
      isAdmin: true,
      params: TasksModel.queueParam,
      body: TasksModel.enqueueBody,
    },
  )
  .post('/:jobId/retry', async ({ params: { jobId } }) => retryJob(jobId), {
    isAdmin: true,
  })
  .post(
    '/:jobId/delete',
    async ({ params: { jobId }, body }) =>
      deleteJob(jobId, body?.force ?? false),
    { isAdmin: true, body: TasksModel.deleteBody },
  )
