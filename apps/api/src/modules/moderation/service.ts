import {
  aiModerationSettings,
  articles,
  comments,
  db,
  moderationQueue,
  sessions,
  users,
} from '@api/libs'
import { purgeTopicPages } from '@api/libs/cloudflare-cache'
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  inArray,
  ne,
  or,
  sql,
} from 'drizzle-orm'
import { status } from 'elysia'
import {
  loadModerationSettings,
  type ModerationSettings,
  type ModerationTargetType,
  moderateWithModel,
} from './llm'
import type { ModerationModel } from './model'

/** 队列状态（与 db/schema/moderation.ts 的注释一致）。 */
export const MODERATION_STATUSES = [
  'analyzing',
  'pending',
  'auto_banned',
  'confirmed',
  'restored',
  'failed',
] as const

export type ModerationStatus = (typeof MODERATION_STATUSES)[number]

/** 需要人工关注的终态：恢复记录时用它判断还有没有别的封禁理由。 */
const ACTIVE_BAN_STATUSES: ModerationStatus[] = [
  'pending',
  'auto_banned',
  'confirmed',
]

/** 送审入口的载荷。 */
export type InspectPayload = {
  targetType: ModerationTargetType
  targetId: string
  userId: string
  title?: string | null
  content: string
}

/** 配置读取结果：永远不返回 apiKey 明文，只给脱敏提示。 */
export type ModerationSettingsView = {
  enabled: boolean
  apiBase: string
  model: string
  prompt: string
  temperature: number
  timeoutMs: number
  banThreshold: number
  autoBan: boolean
  checkComments: boolean
  checkTopics: boolean
  maxContentLength: number
  hasApiKey: boolean
  apiKeyHint: string | null
  updatedAt: Date | null
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return '••••••••'
  return key.slice(0, 4) + '••••••••' + key.slice(-4)
}

function toView(
  settings: ModerationSettings,
  updatedAt: Date | null,
): ModerationSettingsView {
  return {
    enabled: settings.enabled,
    apiBase: settings.apiBase,
    model: settings.model,
    prompt: settings.prompt,
    temperature: settings.temperature,
    timeoutMs: settings.timeoutMs,
    banThreshold: settings.banThreshold,
    autoBan: settings.autoBan,
    checkComments: settings.checkComments,
    checkTopics: settings.checkTopics,
    maxContentLength: settings.maxContentLength,
    hasApiKey: !!settings.apiKey,
    apiKeyHint: settings.apiKey ? maskApiKey(settings.apiKey) : null,
    updatedAt,
  }
}

function bannedReasonOf(confidence: number, reason: string): string {
  const percent = Math.round(confidence * 100)
  return `AI 内容审核：判定为广告 / 垃圾内容（可信度 ${percent}%）${reason ? `；${reason}` : ''}`
}

export const ModerationService = {
  /** 后台配置读取（apiKey 脱敏）。 */
  async getSettings(): Promise<ModerationSettingsView> {
    const settings = await loadModerationSettings()
    const [row] = await db
      .select({ updatedAt: aiModerationSettings.updatedAt })
      .from(aiModerationSettings)
      .where(eq(aiModerationSettings.id, 1))
    return toView(settings, row?.updatedAt ?? null)
  },

  /** 后台配置保存（部分更新，apiKey 三态语义见 model.ts）。 */
  async updateSettings(
    input: ModerationModel.settingsUpdate,
  ): Promise<ModerationSettingsView> {
    const now = new Date()
    const values: Record<string, unknown> = { updatedAt: now }

    if (input.enabled !== undefined) values.enabled = input.enabled
    if (input.apiBase !== undefined) {
      const base = input.apiBase.trim()
      values.apiBase = base || 'https://api.openai.com/v1'
    }
    if (input.apiKey !== undefined) {
      const key = input.apiKey.trim()
      values.apiKey = key || null
    }
    if (input.model !== undefined) values.model = input.model.trim()
    if (input.prompt !== undefined) values.prompt = input.prompt
    if (input.temperature !== undefined) values.temperature = input.temperature
    if (input.timeoutMs !== undefined) values.timeoutMs = input.timeoutMs
    if (input.banThreshold !== undefined)
      values.banThreshold = input.banThreshold
    if (input.autoBan !== undefined) values.autoBan = input.autoBan
    if (input.checkComments !== undefined)
      values.checkComments = input.checkComments
    if (input.checkTopics !== undefined) values.checkTopics = input.checkTopics
    if (input.maxContentLength !== undefined)
      values.maxContentLength = input.maxContentLength

    await db
      .insert(aiModerationSettings)
      .values({ id: 1, ...values })
      .onConflictDoUpdate({
        target: aiModerationSettings.id,
        set: values,
      })

    return ModerationService.getSettings()
  },

  /** 用当前配置直接测一段文本（不落库、不改内容），用于后台调试提示词。 */
  async testModel(input: ModerationModel.test) {
    const settings = await loadModerationSettings()
    if (!settings.apiKey) {
      throw status(400, '请先在配置里填写并保存 API Key')
    }

    const startedAt = Date.now()
    const { verdict } = await moderateWithModel(settings, {
      targetType: input.targetType ?? 'comment',
      title: input.title ?? null,
      content: input.content,
    })

    return {
      verdict: verdict.isSpam ? ('spam' as const) : ('clean' as const),
      confidence: verdict.confidence,
      reason: verdict.reason,
      category: verdict.category ?? null,
      latencyMs: Date.now() - startedAt,
      model: settings.model,
    }
  },

  /**
   * 送审入口：评论 / 帖子创建后调用。
   *
   * 只有「入队」是同步的（一次 INSERT，保证进程意外退出后后台还能看到这条
   * 待分析记录），真正的模型调用在后台跑，不阻塞用户发帖。
   */
  async enqueueInspection(payload: InspectPayload): Promise<void> {
    const settings = await loadModerationSettings()
    if (!settings.enabled) return
    if (payload.targetType === 'comment' && !settings.checkComments) return
    if (payload.targetType === 'topic' && !settings.checkTopics) return

    const [row] = await db
      .insert(moderationQueue)
      .values({
        targetType: payload.targetType,
        targetId: payload.targetId,
        userId: payload.userId,
        title: payload.title ?? null,
        content: payload.content,
        status: 'analyzing',
        model: settings.model,
      })
      .returning({ id: moderationQueue.id })

    if (!row) return
    void ModerationService.analyze(row.id).catch((error) => {
      console.error('[moderation] 审核任务异常:', error)
    })
  },

  /** 跑一次模型判定，并把结论落到内容与队列上。 */
  async analyze(queueId: number): Promise<void> {
    const [row] = await db
      .select()
      .from(moderationQueue)
      .where(eq(moderationQueue.id, queueId))

    if (!row) return
    if (row.status !== 'analyzing') return

    const settings = await loadModerationSettings()
    if (!settings.enabled) {
      await db.delete(moderationQueue).where(eq(moderationQueue.id, queueId))
      return
    }

    try {
      const { verdict, raw } = await moderateWithModel(settings, {
        targetType: row.targetType as ModerationTargetType,
        title: row.title,
        content: row.content,
      })

      // 判定正常：内容不动，记录也不留（队列表只放需要人看的）。
      if (!verdict.isSpam) {
        await db.delete(moderationQueue).where(eq(moderationQueue.id, queueId))
        return
      }

      await ModerationService.markContentDeleted(row.targetType, row.targetId)

      const { banned } = await ModerationService.decideBan(
        row.userId,
        verdict.confidence,
        verdict.reason,
        settings,
      )

      await db
        .update(moderationQueue)
        .set({
          verdict: 'spam',
          confidence: verdict.confidence,
          reason: verdict.reason,
          model: settings.model,
          raw: raw as never,
          banned,
          error: null,
          status: banned ? 'auto_banned' : 'pending',
        })
        .where(eq(moderationQueue.id, queueId))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await db
        .update(moderationQueue)
        .set({ status: 'failed', error: message.slice(0, 1000) })
        .where(eq(moderationQueue.id, queueId))
    }
  },

  /** 可信度够高且开启自动封禁时封号。 */
  async decideBan(
    userId: string,
    confidence: number,
    reason: string,
    settings: ModerationSettings,
  ): Promise<{ banned: boolean }> {
    if (!settings.autoBan || confidence < settings.banThreshold) {
      return { banned: false }
    }
    return {
      banned: await ModerationService.banUserNow(
        userId,
        bannedReasonOf(confidence, reason),
      ),
    }
  },

  /**
   * 直接封禁作者。
   *
   * 管理员账号永不自动封禁：提示词误判一次就把运维锁在后台外，代价太大。
   * 已经封禁的账号视为「不是本次封的」，返回 false，恢复时不至于把别人的封禁解掉。
   */
  async banUserNow(userId: string, reason: string): Promise<boolean> {
    const [user] = await db
      .select({ id: users.id, role: users.role, banned: users.banned })
      .from(users)
      .where(eq(users.id, userId))

    if (!user) return false

    const roles = (user.role ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    if (roles.includes('admin')) return false
    if (user.banned) return false

    await db
      .update(users)
      .set({
        banned: true,
        banReason: reason,
        banExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))

    // Better Auth 只在「建会话」时拦 banned，已登录的会话不会自己失效；
    // 官方 banUser 端点封号后同样会 deleteUserSessions，这里保持一致 ——
    // 否则广告号还能拿旧 cookie 继续发帖。
    await db.delete(sessions).where(eq(sessions.userId, userId))

    return true
  },

  /** 把命中的内容标记为已删除（评论软删 / 帖子 status='deleted'）。 */
  async markContentDeleted(targetType: string, targetId: string) {
    const now = new Date()
    if (targetType === 'comment') {
      await db
        .update(comments)
        .set({ status: 'deleted', deletedAt: now })
        .where(and(eq(comments.id, targetId), eq(comments.status, 'normal')))
      return
    }
    if (targetType === 'topic') {
      const id = Number(targetId)
      if (!Number.isInteger(id)) return
      const [updated] = await db
        .update(articles)
        .set({ status: 'deleted', updatedAt: now })
        .where(and(eq(articles.id, id), eq(articles.type, 'topic')))
        .returning({ id: articles.id })
      // 后台任务不在请求链里，API 层按路由前缀的兜底清理不会触发，这里自己清。
      if (updated) void purgeTopicPages(String(id))
    }
  },

  /** 审核页列表：默认只看待处理，分面计数供顶部筛选展示。 */
  async listQueue(query: ModerationModel.queueList) {
    const page = Math.max(1, Number(query.page ?? 1))
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)))
    const offset = (page - 1) * limit

    const conditions = []
    const statusFilter = query.status?.trim()
    if (statusFilter && statusFilter !== 'all') {
      if (!MODERATION_STATUSES.includes(statusFilter as ModerationStatus)) {
        throw status(400, `未知的审核状态：${statusFilter}`)
      }
      conditions.push(eq(moderationQueue.status, statusFilter))
    } else if (!statusFilter) {
      conditions.push(eq(moderationQueue.status, 'pending'))
    }
    if (query.targetType) {
      conditions.push(eq(moderationQueue.targetType, query.targetType))
    }
    const keyword = query.search?.trim()
    if (keyword) {
      const pattern = `%${keyword}%`
      conditions.push(
        or(
          ilike(moderationQueue.content, pattern),
          ilike(moderationQueue.title, pattern),
        ),
      )
    }

    const where = conditions.length ? and(...conditions) : undefined

    const [rows, totalRow, counts] = await Promise.all([
      db
        .select({
          ...getTableColumns(moderationQueue),
          user: sql<{
            id: string
            name: string
            email: string
            image: string | null
          } | null>`
            CASE WHEN ${users.id} IS NOT NULL
              THEN json_build_object('id', ${users.id}, 'name', ${users.name}, 'email', ${users.email}, 'image', ${users.image})
              ELSE NULL
            END
          `.as('user'),
        })
        .from(moderationQueue)
        .leftJoin(users, eq(moderationQueue.userId, users.id))
        .where(where)
        .orderBy(desc(moderationQueue.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(moderationQueue)
        .where(where)
        .then((r) => r[0]),
      db
        .select({ status: moderationQueue.status, total: count() })
        .from(moderationQueue)
        .groupBy(moderationQueue.status),
    ])

    // 反查内容所在位置（评论 → 它挂在哪条游戏/帖子下；帖子 → 自身状态），
    // 后台需要「打开原文」的链接，也需要知道内容当前是不是还被删着。
    const commentIds = rows
      .filter((row) => row.targetType === 'comment')
      .map((row) => row.targetId)
    const topicIds = rows
      .filter((row) => row.targetType === 'topic')
      .map((row) => Number(row.targetId))
      .filter((id) => Number.isInteger(id))

    const [commentSources, topicSources] = await Promise.all([
      commentIds.length
        ? db
            .select({
              id: comments.id,
              targetType: comments.targetType,
              targetId: comments.targetId,
              status: comments.status,
            })
            .from(comments)
            .where(inArray(comments.id, commentIds))
        : Promise.resolve([]),
      topicIds.length
        ? db
            .select({ id: articles.id, status: articles.status })
            .from(articles)
            .where(inArray(articles.id, topicIds))
        : Promise.resolve([]),
    ])

    const commentSourceById = new Map(
      commentSources.map((item) => [item.id, item]),
    )
    const topicSourceById = new Map(topicSources.map((item) => [item.id, item]))

    const items = rows.map((row) => {
      if (row.targetType === 'comment') {
        const source = commentSourceById.get(row.targetId)
        return {
          ...row,
          source: source
            ? {
                targetType: source.targetType,
                targetId: source.targetId,
                status: source.status,
              }
            : null,
        }
      }
      const source = topicSourceById.get(Number(row.targetId))
      return {
        ...row,
        source: source
          ? {
              targetType: 'topic',
              targetId: row.targetId,
              status: source.status,
            }
          : null,
      }
    })

    const countMap: Record<string, number> = {}
    for (const item of counts) {
      countMap[item.status] = Number(item.total ?? 0)
    }

    const total = Number(totalRow?.total ?? 0)
    return {
      items,
      total,
      totalPages: Math.ceil(total / limit),
      counts: {
        analyzing: countMap.analyzing ?? 0,
        pending: countMap.pending ?? 0,
        auto_banned: countMap.auto_banned ?? 0,
        confirmed: countMap.confirmed ?? 0,
        restored: countMap.restored ?? 0,
        failed: countMap.failed ?? 0,
      },
    }
  },

  /** 人工确认广告：内容保持删除，可选封禁作者。 */
  async confirm(
    { id }: ModerationModel.queueParams,
    adminId: string,
    { banUser }: ModerationModel.confirm,
  ) {
    const queueId = Number(id)
    const [row] = await db
      .select()
      .from(moderationQueue)
      .where(eq(moderationQueue.id, queueId))

    if (!row) throw status(404, '审核记录不存在')

    // 确认即代表「确实要删」：避免管理员先前手动恢复过的内容又回到前台。
    await ModerationService.markContentDeleted(row.targetType, row.targetId)

    let banned = row.banned
    if (banUser && !banned) {
      const reason = `管理员确认广告 / 垃圾内容${row.reason ? `；${row.reason}` : ''}`
      banned =
        (await ModerationService.banUserNow(row.userId, reason)) || banned
    }

    await db
      .update(moderationQueue)
      .set({
        status: 'confirmed',
        verdict: row.verdict ?? 'spam',
        banned,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      })
      .where(eq(moderationQueue.id, queueId))

    return { success: true, banned }
  },

  /** 判定误判：恢复内容；若本次记录触发了封禁且没有其它记录，顺带解封。 */
  async restore({ id }: ModerationModel.queueParams, adminId: string) {
    const queueId = Number(id)
    const [row] = await db
      .select()
      .from(moderationQueue)
      .where(eq(moderationQueue.id, queueId))

    if (!row) throw status(404, '审核记录不存在')

    if (row.status !== 'restored') {
      await ModerationService.restoreContent(row.targetType, row.targetId)
    }

    let unbanned = false
    if (row.banned) {
      const [others] = await db
        .select({ total: count() })
        .from(moderationQueue)
        .where(
          and(
            eq(moderationQueue.userId, row.userId),
            eq(moderationQueue.banned, true),
            inArray(moderationQueue.status, ACTIVE_BAN_STATUSES),
            ne(moderationQueue.id, queueId),
          ),
        )

      if (Number(others?.total ?? 0) === 0) {
        await db
          .update(users)
          .set({ banned: false, banReason: null, banExpires: null })
          .where(eq(users.id, row.userId))
        unbanned = true
      }
    }

    await db
      .update(moderationQueue)
      .set({
        status: 'restored',
        banned: false,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      })
      .where(eq(moderationQueue.id, queueId))

    return { success: true, unbanned }
  },

  /** 恢复内容：只把「被审核删掉」的内容放回去，不覆盖管理员后来的手动状态。 */
  async restoreContent(targetType: string, targetId: string) {
    const now = new Date()
    if (targetType === 'comment') {
      await db
        .update(comments)
        .set({ status: 'normal', deletedAt: null })
        .where(and(eq(comments.id, targetId), eq(comments.status, 'deleted')))
      return
    }
    if (targetType === 'topic') {
      const id = Number(targetId)
      if (!Number.isInteger(id)) return
      const [restored] = await db
        .update(articles)
        .set({ status: 'published', updatedAt: now })
        .where(
          and(
            eq(articles.id, id),
            eq(articles.type, 'topic'),
            eq(articles.status, 'deleted'),
          ),
        )
        .returning({ id: articles.id })
      if (restored) void purgeTopicPages(String(id))
    }
  },

  /** 失败重试：把记录拉回 analyzing 后重新调用模型。 */
  async retry({ id }: ModerationModel.queueParams) {
    const queueId = Number(id)
    const settings = await loadModerationSettings()
    if (!settings.enabled) {
      throw status(400, '内容审核未启用，请先在配置里开启')
    }

    const [row] = await db
      .select({
        id: moderationQueue.id,
        status: moderationQueue.status,
        createdAt: moderationQueue.createdAt,
      })
      .from(moderationQueue)
      .where(eq(moderationQueue.id, queueId))

    if (!row) throw status(404, '审核记录不存在')

    // analyzing 通常意味着进程内的模型调用还在跑；但进程重启后它会永久卡住，
    // 因此只有「最近 10 分钟内入队」才当作真的在分析，超时的允许人工重试。
    if (row.status === 'analyzing') {
      const age = Date.now() - new Date(row.createdAt).getTime()
      if (Number.isFinite(age) && age < 10 * 60 * 1000) {
        throw status(409, '该记录正在分析中，请稍后再试')
      }
    }

    await db
      .update(moderationQueue)
      .set({ status: 'analyzing', error: null })
      .where(eq(moderationQueue.id, queueId))

    void ModerationService.analyze(queueId).catch((error) => {
      console.error('[moderation] 重试分析异常:', error)
    })

    return { success: true }
  },
}
