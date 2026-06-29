import { api } from '@libs'
import { createServerFn } from '@tanstack/react-start'
import { elysiaErrorF } from '@web/lib'
import { cookiePass } from '@web/lib/cookie-pass'
import z from 'zod'

/**
 * 获取 Meilisearch 实例统计信息
 */

export const getMeiliStats = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { data, error } = await api.search.getStats.get(cookiePass())
    elysiaErrorF(error)
    return data
  },
)

/**
 * 获取 Embedders 配置
 */
export const getEmbedders = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { data, error } =
      await api.search.meilisearchEmbeddersGet.get(cookiePass())
    elysiaErrorF(error)
    return data
  },
)

/**
 * 更新 Embedders 配置
 */
export const updateEmbedders = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      url: z.string().min(1, 'URL 不能为空'),
      embeddingApiKey: z.string(),
      model: z.string().min(1, 'Model 不能为空'),
      documentTemplateMaxBytes: z.number().min(1),
      documentTemplate: z.string().min(1, 'Document Template 不能为空'),
    }),
  )
  .handler(async ({ data: body }) => {
    const { data, error } = await api.search.meilisearchEmbeddersUpdate.post(
      body,
      cookiePass(),
    )
    elysiaErrorF(error)
    return data
  })

/**
 * 获取属性列表
 */
export const getPropertyList = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { data, error } =
      await api.search.meilisearchPropertylist.get(cookiePass())
    elysiaErrorF(error)
    return data
  },
)

/**
 * 获取搜索属性
 */
export const getSearchableAttributes = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { data, error } =
    await api.search.meilisearcSearchableAttributeshGet.get(cookiePass())
  elysiaErrorF(error)
  return data
})

/**
 * 更新搜索属性
 */
export const updateSearchableAttributes = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      fields: z.array(z.string()),
    }),
  )
  .handler(async ({ data: body }) => {
    const { data, error } =
      await api.search.meilisearcSearchableAttributeshUpdate.post(
        body,
        cookiePass(),
      )
    elysiaErrorF(error)
    return data
  })

/**
 * 触发游戏索引重建
 */
export const triggerGameIndexRebuild = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { data, error } = await api.task.meiliSearchAddIndex.get(cookiePass())
  elysiaErrorF(error)
  return data
})

/**
 * 触发标签索引重建
 */
export const triggerTagIndexRebuild = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { data, error } = await api.task.meiliSearchAddTag.get(cookiePass())
    elysiaErrorF(error)
    return data
  },
)
