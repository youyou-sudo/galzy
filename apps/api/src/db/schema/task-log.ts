import { relations } from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

/** 任务执行的生命周期记录（对应一个 bun-queue job）。 */
export const queueJob = pgTable(
  'galrc_queue_job',
  {
    /** 直接采用 bun-queue 的 job.id（Redis 侧同一 ID，便于联查/去重）。 */
    id: varchar('id', { length: 255 }).primaryKey(),
    /** 队列名（galzy:vndb-sync 等）。 */
    queue: varchar('queue', { length: 64 }).notNull(),
    /** 任务类型（vndb-full / meili-game / cloudreve-sync …）。 */
    type: varchar('type', { length: 64 }).notNull(),
    /** queued | running | completed | failed | dead-letter | interrupted */
    status: varchar('status', { length: 16 }).notNull().default('queued'),
    /** 进度百分比 0–100；绝对数（如 processedItems/totalItems）存 result。 */
    progress: integer('progress').notNull().default(0),
    /** 入队参数快照（TaskPayload）。 */
    payload: jsonb('payload'),
    /** 完成时的 returnvalue（含绝对计数等）。 */
    result: jsonb('result'),
    /** 失败原因（failed / dead-letter 时）。 */
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    queueIdx: index('idx_queue_job_queue').on(table.queue),
    typeIdx: index('idx_queue_job_type').on(table.type),
    statusIdx: index('idx_queue_job_status').on(table.status),
    // 支撑 TTL 清理（按 createdAt 分批删除）与「最近任务」查询
    createdAtIdx: index('idx_queue_job_created_at').on(table.createdAt),
    // ── 以下为列表 V2 的排序白名单与「筛选 + 排序」组合索引 ──
    // 列表默认视图按 created_at DESC + status/queue/type 过滤，
    // 单列低基数索引（status 只有 6 值）planner 常直接放弃，组合索引才真正可用。
    queueCreatedIdx: index('idx_queue_job_queue_created').on(
      table.queue,
      table.createdAt.desc(),
    ),
    statusCreatedIdx: index('idx_queue_job_status_created').on(
      table.status,
      table.createdAt.desc(),
    ),
    typeCreatedIdx: index('idx_queue_job_type_created').on(
      table.type,
      table.createdAt.desc(),
    ),
    queueStatusCreatedIdx: index('idx_queue_job_queue_status_created').on(
      table.queue,
      table.status,
      table.createdAt.desc(),
    ),
    // 排序白名单新增的两列：排队任务的这两列为 NULL，需 NULLS LAST 语义
    startedIdx: index('idx_queue_job_started_at').on(table.startedAt.desc()),
    finishedIdx: index('idx_queue_job_finished_at').on(table.finishedAt.desc()),
  }),
)

/** 任务执行日志（每行一条，随任务流式追加）。 */
export const queueJobLog = pgTable(
  'galrc_queue_job_log',
  {
    id: serial('id').primaryKey(),
    /** 关联 queueJob.id；job 被清理时级联删除，避免残留孤儿日志。 */
    jobId: varchar('job_id', { length: 255 })
      .notNull()
      .references(() => queueJob.id, { onDelete: 'cascade' }),
    /** info | warn | error | success */
    level: varchar('level', { length: 8 }).notNull(),
    message: text('message').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // (jobId, createdAt) 支撑「某任务日志按时间流式读取」+ TTL 分批清理
    jobCreatedIdx: index('idx_queue_job_log_job_created').on(
      table.jobId,
      table.createdAt,
    ),
    createdAtIdx: index('idx_queue_job_log_created_at').on(table.createdAt),
  }),
)

export const queueJobRelations = relations(queueJob, ({ many }) => ({
  logs: many(queueJobLog),
}))

export const queueJobLogRelations = relations(queueJobLog, ({ one }) => ({
  job: one(queueJob, {
    fields: [queueJobLog.jobId],
    references: [queueJob.id],
  }),
}))
