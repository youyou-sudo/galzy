import { betterAuth } from '@api/modules/auth'
import { Elysia } from 'elysia'
import { TasksModel } from './model'
import { enqueue, getJobDetail, getJobLogs, listJobs } from './service'

/**
 * 任务队列查询/触发接口（管理侧）。
 *
 * - 手动入队（POST /tasks/:queue）替代原 cron/vndb-sync 的 GET/POST 触发点。
 * - 状态/进度/日志查询替代原 getMeiliProgress / getProgress / addMeiliLog。
 */
export const tasks = new Elysia({ prefix: '/tasks' })
  .use(betterAuth)
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
      const jobId = await enqueue(queue, { type: body.type } as any)
      return { ok: true, jobId }
    },
    { isAdmin: true, body: TasksModel.enqueueBody },
  )
