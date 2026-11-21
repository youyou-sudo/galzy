import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * galrc_ai_moderation_settings — 大模型内容审核配置（单行表，id 恒为 1）。
 *
 * 为什么单独建表而不是塞进 galrc_siteConfig：这里的字段要直接驱动后台表单
 * （开关 / 阈值 / 提示词），并且 apiKey 需要在读取时脱敏，单行强类型表比
 * jsonb 更容易保证「读出来的结构就是表单结构」。
 *
 * prompt 留空表示使用代码里的默认提示词（modules/moderation/prompt.ts），
 * 这样升级默认提示词不需要回填数据库。
 */
export const aiModerationSettings = pgTable('galrc_ai_moderation_settings', {
  id: integer('id').primaryKey(),
  /** 总开关：关闭后创建评论/帖子不再入队，也不会有任何大模型请求。 */
  enabled: boolean('enabled').notNull().default(false),
  /** OpenAI 兼容接口的 base URL（如 https://api.deepseek.com/v1）。 */
  apiBase: text('api_base').notNull().default('https://api.openai.com/v1'),
  /** API Key；只在服务端使用，读取接口永远不返回明文。 */
  apiKey: text('api_key'),
  model: varchar('model', { length: 128 }).notNull().default('gpt-4o-mini'),
  /** 系统提示词；支持 {{title}} / {{content}} 占位符（无占位符时内容走 user 消息）。 */
  prompt: text('prompt').notNull().default(''),
  temperature: real('temperature').notNull().default(0),
  timeoutMs: integer('timeout_ms').notNull().default(20000),
  /** 可信度 ≥ 该值才自动封禁；低于该值的广告进「待处理」列表人工判断。 */
  banThreshold: real('ban_threshold').notNull().default(0.85),
  /** 高可信广告是否自动封禁作者。 */
  autoBan: boolean('auto_ban').notNull().default(true),
  checkComments: boolean('check_comments').notNull().default(true),
  checkTopics: boolean('check_topics').notNull().default(true),
  /** 送审内容的最大字符数（超出截断，避免超长正文拖慢/超时）。 */
  maxContentLength: integer('max_content_length').notNull().default(4000),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

/**
 * galrc_moderation_queue — 审核队列 + 处置记录。
 *
 * 除了「需要人看」的行（命中广告：低可信待处理 / 高可信已自动封禁、人工确认/
 * 恢复后的留档、调用失败），判定为正常的内容也以 clean 留痕：后台「已通过」里
 * 能看到送审记录，而不是内容发出去后毫无痕迹。
 *
 * 状态机：
 *   analyzing ──(判定正常)──▶ clean
 *            ├─(低可信广告)─▶ pending ──确认──▶ confirmed
 *            │                        └─恢复──▶ restored
 *            ├─(高可信广告)─▶ auto_banned ──确认──▶ confirmed
 *            │                            └─恢复──▶ restored
 *            └─(调用失败)──▶ failed ──重试──▶ analyzing
 */
export const moderationQueue = pgTable(
  'galrc_moderation_queue',
  {
    id: serial('id').primaryKey(),
    /** comment（galrc_comments.id）/ topic（galrc_article.id，type='topic'） */
    targetType: varchar('target_type', { length: 16 }).notNull(),
    targetId: varchar('target_id', { length: 64 }).notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    /** 帖子标题；评论为 NULL。 */
    title: text('title'),
    /** 送审时的内容快照（内容随后可能被删改，审核页必须看到原文）。 */
    content: text('content').notNull(),
    status: varchar('status', { length: 24 }).notNull().default('analyzing'),
    /** spam | clean；分析中/失败为 NULL。 */
    verdict: varchar('verdict', { length: 16 }),
    /** 模型自报的可信度 0..1。 */
    confidence: real('confidence'),
    /** 模型给出的中文理由。 */
    reason: text('reason'),
    model: varchar('model', { length: 128 }),
    /** 原始响应（排障用）。 */
    raw: jsonb('raw'),
    error: text('error'),
    /** 本条记录是否真的执行了封禁（恢复时据此决定要不要解封）。 */
    banned: boolean('banned').notNull().default(false),
    reviewedBy: varchar('reviewed_by', { length: 255 }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // 后台默认视图固定 WHERE status = ? ORDER BY created_at DESC；
    // 分面计数走同一前缀。
    statusCreatedIdx: index('idx_galrc_moderation_queue_status_created').on(
      table.status,
      table.createdAt,
    ),
    userIdx: index('idx_galrc_moderation_queue_user').on(table.userId),
    targetIdx: index('idx_galrc_moderation_queue_target').on(
      table.targetType,
      table.targetId,
    ),
  }),
)
