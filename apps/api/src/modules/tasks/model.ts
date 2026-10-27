import { t } from 'elysia'

/* ────────────────────────── 任务字典（唯一权威） ────────────────────────── */

/**
 * 任务状态白名单。
 *
 * 与 db/schema/task-log.ts 的 status 列注释、前端状态分段控件三处同源；
 * 任何新增状态都必须先改这里，否则查询会被 INVALID_FILTER 拦下。
 */
export const TASK_STATUSES = [
  'queued',
  'running',
  'completed',
  'failed',
  'dead-letter',
  'interrupted',
] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]

/** 终态：任务已结束，不再占用 Worker。只有终态允许删除记录。 */
export const TERMINAL_STATUSES = [
  'completed',
  'failed',
  'dead-letter',
  'interrupted',
] as const

export function isTerminalStatus(value: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(value)
}

/** 排序白名单：只允许这几列，杜绝任意列排序（SQL 注入与慢查询双保险）。 */
export const TASK_SORT_FIELDS = [
  'createdAt',
  'startedAt',
  'finishedAt',
  'status',
  'type',
] as const

export type TaskSortField = (typeof TASK_SORT_FIELDS)[number]

/** 状态中文名（前端 state meta 也由此下发，避免两处维护）。 */
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  queued: '排队中',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  'dead-letter': '死信',
  interrupted: '已中断',
}

/** 队列中文名。 */
export const QUEUE_LABELS: Record<string, string> = {
  'galzy:vndb-sync': 'VNDB 同步',
  'galzy:kungal-sync': 'Kungal 同步',
  'galzy:meili-index': 'Meili 索引',
  'galzy:cloudreve-sync': 'Cloudreve 同步',
  'galzy:metrics': '指标/清理',
}

/** 任务类型中文名。 */
export const TYPE_LABELS: Record<string, string> = {
  'vndb-full': 'VNDB 全量同步',
  'vndb-delta': 'VNDB 增量同步',
  'vndb-producers': '开发者同步',
  'kungal-full': 'Kungal 全量同步',
  'kungal-delta': 'Kungal 增量同步',
  'meili-game': '游戏索引重建',
  'meili-tag': '标签索引重建',
  'meili-producer': '厂商索引重建',
  'cloudreve-sync': 'Cloudreve 文件同步',
  'queue-log-prune': '队列日志清理',
}

/**
 * 优先级派生（当前表无 priority 列，按「队列语义 + 类型」映射）。
 *
 * P0 全量刷新会阻塞后续增量；P1 常规数据新鲜度；P2 可重放；P3 纯维护。
 * 若将来引入人工优先级（priority 列），此处降级为默认值即可。
 */
export const TYPE_PRIORITY: Record<string, 'P0' | 'P1' | 'P2' | 'P3'> = {
  'vndb-full': 'P0',
  'kungal-full': 'P0',
  'vndb-delta': 'P1',
  'kungal-delta': 'P1',
  'cloudreve-sync': 'P1',
  'vndb-producers': 'P1',
  'meili-game': 'P2',
  'meili-tag': 'P2',
  'meili-producer': 'P2',
  'queue-log-prune': 'P3',
}

/** 各类型的 SLA（分钟）：超过即视为「逾期」，用于列表高亮与 overdue 过滤。 */
export const TYPE_SLA_MINUTES: Record<string, number> = {
  'vndb-full': 120,
  'kungal-full': 120,
  'vndb-delta': 30,
  'kungal-delta': 30,
  'vndb-producers': 60,
  'meili-game': 60,
  'meili-tag': 60,
  'meili-producer': 60,
  'cloudreve-sync': 30,
  'queue-log-prune': 30,
}

/** 排队超过该分钟数视为「滞留」（Worker 可能卡住/未启动）。 */
export const QUEUE_WAIT_SLA_MINUTES = 10

/* ────────────────────────────── 请求/响应模型 ────────────────────────────── */

/** 多值参数：Elysia 的 query 解析器只在重复 key 时产出数组，逗号不拆。 */
const MultiString = t.Optional(
  t.Union([t.String({ minLength: 1 }), t.Array(t.String({ minLength: 1 }))]),
)

export namespace TasksModel {
  /** 手动入队请求体（POST /tasks/enqueue/:queue） */
  export const enqueueBody = t.Object({
    type: t.String({ minLength: 1 }),
  })

  /** 队列名路径参数（白名单在 service 层用 QUEUE 常量校验） */
  export const queueParam = t.Object({
    queue: t.String({ minLength: 1, maxLength: 64 }),
  })

  /** 队列 + jobId（单条死信操作） */
  export const deadLetterJobBody = t.Object({
    jobId: t.String({ minLength: 1, maxLength: 255 }),
  })

  /** 批量死信操作（每条一次 Redis 往返，上限比任务删除小） */
  export const deadLetterBatchBody = t.Object({
    jobIds: t.Array(t.String({ minLength: 1, maxLength: 255 }), {
      minItems: 1,
      maxItems: 100,
    }),
  })

  /** 批量重试（逐项独立结果，部分失败不整体回滚） */
  export const batchRetryBody = t.Object({
    ids: t.Array(t.String({ minLength: 1, maxLength: 255 }), {
      minItems: 1,
      maxItems: 100,
    }),
  })

  /** 批量删除任务记录（仅终态可删，其余逐项回报 409） */
  export const batchDeleteBody = t.Object({
    ids: t.Array(t.String({ minLength: 1, maxLength: 255 }), {
      minItems: 1,
      maxItems: 500,
    }),
  })

  /** 单条删除：force 才允许删非终态（先 removeJob 再删记录）。 */
  export const deleteBody = t.Optional(
    t.Object({
      force: t.Optional(t.Boolean({ default: false })),
    }),
  )

  /**
   * 任务列表查询（V1 参数全部保留语义，新参数为纯增量）。
   *
   * - page（1 基）与 pageIndex（0 基）二选一，同时传以 page 为准；
   * - status/queue/type 与 statuses/queues/types 同时传取并集；
   * - pageSize 上限维持 100，避免一次拉爆。
   */
  export const listQuery = t.Object({
    // ── V1（保持） ──
    queue: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
    type: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
    status: t.Optional(t.String({ minLength: 1, maxLength: 32 })),
    pageIndex: t.Optional(t.Number({ minimum: 0, default: 0 })),
    pageSize: t.Number({ minimum: 1, maximum: 100, default: 20 }),

    // ── V2 新增 ──
    q: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
    statuses: MultiString,
    queues: MultiString,
    types: MultiString,
    dateFrom: t.Optional(t.String({ minLength: 1, maxLength: 40 })),
    dateTo: t.Optional(t.String({ minLength: 1, maxLength: 40 })),
    overdue: t.Optional(t.Boolean({ default: false })),
    retryable: t.Optional(t.Boolean({ default: false })),
    sort: t.Optional(
      t.Union([
        t.Literal('createdAt'),
        t.Literal('startedAt'),
        t.Literal('finishedAt'),
        t.Literal('status'),
        t.Literal('type'),
      ]),
    ),
    order: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')])),
    page: t.Optional(t.Number({ minimum: 1 })),
    withCounts: t.Optional(t.Boolean({ default: true })),
  })

  /** 日志增量轮询：afterId 只取更新的行；省略时返回最近 limit 条（升序）。 */
  export const logsQuery = t.Object({
    limit: t.Number({ minimum: 1, maximum: 500, default: 200 }),
    afterId: t.Optional(t.Number({ minimum: 0 })),
    level: t.Optional(
      t.Union([
        t.Literal('info'),
        t.Literal('warn'),
        t.Literal('error'),
        t.Literal('success'),
      ]),
    ),
  })

  /** 死信列表分页 */
  export const deadLetterQuery = t.Object({
    pageSize: t.Number({ minimum: 1, maximum: 500, default: 100 }),
    pageIndex: t.Number({ minimum: 0, default: 0 }),
  })

  export type enqueueBody = typeof enqueueBody.static
  export type listQuery = typeof listQuery.static
  export type logsQuery = typeof logsQuery.static
  export type batchRetryBody = typeof batchRetryBody.static
  export type batchDeleteBody = typeof batchDeleteBody.static
  export type deadLetterBatchBody = typeof deadLetterBatchBody.static
}
