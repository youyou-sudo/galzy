import { t } from 'elysia'

export namespace ModerationModel {
  /** 队列筛选：status=all 表示全部；不传等同 pending。 */
  export const QueueList = t.Object({
    status: t.Optional(t.String()),
    targetType: t.Optional(t.String()),
    page: t.Optional(t.Number({ default: 1, minimum: 1 })),
    limit: t.Optional(t.Number({ default: 20, minimum: 1, maximum: 100 })),
    search: t.Optional(t.String()),
  })

  export const QueueParams = t.Object({
    id: t.String(),
  })

  /** 人工确认广告：可选同时封禁作者。 */
  export const Confirm = t.Object({
    banUser: t.Optional(t.Boolean()),
  })

  /**
   * 配置更新：全部可选（部分更新）。
   * apiKey 三态 —— 不传 = 保持不变；空串 = 清空；非空 = 覆盖。
   */
  export const SettingsUpdate = t.Object({
    enabled: t.Optional(t.Boolean()),
    apiBase: t.Optional(t.String({ maxLength: 500 })),
    apiKey: t.Optional(t.String({ maxLength: 500 })),
    model: t.Optional(t.String({ maxLength: 128 })),
    prompt: t.Optional(t.String({ maxLength: 20000 })),
    temperature: t.Optional(t.Number({ minimum: 0, maximum: 2 })),
    timeoutMs: t.Optional(t.Number({ minimum: 3000, maximum: 120000 })),
    banThreshold: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
    autoBan: t.Optional(t.Boolean()),
    checkComments: t.Optional(t.Boolean()),
    checkTopics: t.Optional(t.Boolean()),
    maxContentLength: t.Optional(t.Number({ minimum: 200, maximum: 20000 })),
  })

  /** 连通性 / 效果测试：给一段文本，直接看模型怎么判。 */
  export const Test = t.Object({
    title: t.Optional(t.String({ maxLength: 200 })),
    content: t.String({ minLength: 1, maxLength: 20000 }),
    targetType: t.Optional(t.Union([t.Literal('comment'), t.Literal('topic')])),
  })

  export type queueList = typeof QueueList.static
  export type queueParams = typeof QueueParams.static
  export type confirm = typeof Confirm.static
  export type settingsUpdate = typeof SettingsUpdate.static
  export type test = typeof Test.static
}
