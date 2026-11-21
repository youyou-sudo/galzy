import { betterAuth } from '@api/modules/auth'
import { Elysia } from 'elysia'
import { ModerationModel } from './model'
import { ModerationService } from './service'

/**
 * 大模型内容审核（管理侧）。
 *
 * 评论 / 帖子创建时由各 service 调 ModerationService.enqueueInspection 入队，
 * 判定逻辑在后台跑；这里只暴露后台需要的读取与人工处置接口：
 * - GET  /moderation/settings      配置（apiKey 脱敏）
 * - PUT  /moderation/settings      保存配置（部分更新）
 * - POST /moderation/settings/test 用当前配置试跑一段文本
 * - GET  /moderation/queue         审核队列（默认待处理 + 分面计数）
 * - POST /moderation/queue/:id/confirm | restore | retry
 */
export const moderation = new Elysia({ prefix: '/moderation' })
  .use(betterAuth)
  .get('/settings', async () => await ModerationService.getSettings(), {
    isAdmin: true,
  })
  .put(
    '/settings',
    async ({ body }) => await ModerationService.updateSettings(body),
    {
      isAdmin: true,
      body: ModerationModel.SettingsUpdate,
    },
  )
  .post(
    '/settings/test',
    async ({ body }) => await ModerationService.testModel(body),
    {
      isAdmin: true,
      body: ModerationModel.Test,
    },
  )
  .get(
    '/queue',
    async ({ query }) => await ModerationService.listQueue(query),
    {
      isAdmin: true,
      query: ModerationModel.QueueList,
    },
  )
  .post(
    '/queue/:id/confirm',
    async ({ params, body, user }) =>
      await ModerationService.confirm(params, user.id, body),
    {
      isAdmin: true,
      params: ModerationModel.QueueParams,
      body: ModerationModel.Confirm,
    },
  )
  .post(
    '/queue/:id/restore',
    async ({ params, user }) =>
      await ModerationService.restore(params, user.id),
    {
      isAdmin: true,
      params: ModerationModel.QueueParams,
    },
  )
  .post(
    '/queue/:id/retry',
    async ({ params }) => await ModerationService.retry(params),
    {
      isAdmin: true,
      params: ModerationModel.QueueParams,
    },
  )
