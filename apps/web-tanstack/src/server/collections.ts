import { api } from '@libs'
import { createServerFn } from '@tanstack/react-start'
import type {
  CollectionData,
  CollectionDataListResponse,
  CollectionListResponse,
  CollectionPreviewGame,
} from '@web/lib/collections'
import { elysiaErrorF } from '@web/lib/elysia-error'
import z from 'zod'

export const getCollections = createServerFn()
  .validator(
    z.object({
      page: z.optional(z.number()),
      limit: z.optional(z.number()),
      status: z.optional(z.string()),
    }),
  )
  .handler(async ({ data }) => {
    const { data: res, error } = await api.collections.get({
      query: {
        page: data.page,
        limit: data.limit,
        status: data.status ?? 'published',
      },
    })
    elysiaErrorF(error)
    // Elysia 推断的响应类型含联合，会被 createServerFn 收敛为 unknown，这里按已知形状定型
    return res as unknown as CollectionDataListResponse
  })

export const getCollectionById = createServerFn()
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { data: res, error } = await api.collections({ id: data.id }).get()
    elysiaErrorF(error)
    // Elysia 推断的响应类型含联合，会被 createServerFn 收敛为 unknown，这里按已知形状定型
    return res as unknown as CollectionData
  })

export const getCollectionPreview = createServerFn()
  .validator(z.object({ id: z.string(), limit: z.optional(z.number()) }))
  .handler(async ({ data }) => {
    const { data: res, error } = await api
      .collections({ id: data.id })
      .preview.get({
        query: { limit: data.limit },
      })
    elysiaErrorF(error)
    return (res ?? []) as CollectionPreviewGame[]
  })

export const getCollectionsWithPreview = createServerFn()
  .validator(
    z.object({
      page: z.optional(z.number().default(1)),
      limit: z.optional(z.number().default(12)),
      previewLimit: z.optional(z.number().default(4)),
      type: z.optional(z.enum(['manual', 'producer'])),
      showR18: z.optional(z.boolean()),
    }),
  )
  .handler(async ({ data }) => {
    const { data: listRes, error: listErr } = await api.collections.get({
      query: {
        status: 'published',
        page: data.page,
        limit: data.limit,
        type: data.type,
        includePreview: data.previewLimit,
        r18: data.showR18,
      },
    })
    elysiaErrorF(listErr)
    // Elysia 推断的响应类型含联合，会被 createServerFn 收敛为 unknown，这里按已知形状定型
    return (listRes ?? {
      items: [],
      total: 0,
      page: data.page,
      limit: data.limit,
    }) as CollectionListResponse
  })
