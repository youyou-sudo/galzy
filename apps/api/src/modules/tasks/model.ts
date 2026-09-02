import { t } from 'elysia'

export namespace TasksModel {
  /** 手动入队请求体（POST /tasks/:queue） */
  export const enqueueBody = t.Object({
    type: t.String(),
  })

  /** 队列名路径参数 */
  export const queueParam = t.Object({
    queue: t.String(),
  })

  /** 队列 + jobId（死信操作请求体） */
  export const deadLetterJobBody = t.Object({
    jobId: t.String(),
  })

  /** 任务列表查询参数（分页 + 过滤） */
  export const listQuery = t.Object({
    queue: t.Optional(t.String()),
    type: t.Optional(t.String()),
    status: t.Optional(t.String()),
    pageSize: t.Number({ minimum: 1, maximum: 100, default: 20 }),
    pageIndex: t.Number({ minimum: 0, default: 0 }),
  })

  /** 日志查询参数 */
  export const logsQuery = t.Object({
    pageSize: t.Number({ minimum: 1, maximum: 500, default: 100 }),
    pageIndex: t.Number({ minimum: 0, default: 0 }),
  })

  export const enqueueBodyType = enqueueBody.static
  export type listQuery = typeof listQuery.static
  export type logsQuery = typeof logsQuery.static
}
