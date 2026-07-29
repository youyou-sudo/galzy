import { api } from '@libs'
import { createServerFn } from '@tanstack/react-start'
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
    return res
  })

export const getCollectionById = createServerFn()
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { data: res, error } = await api.collections({ id: data.id }).get()
    elysiaErrorF(error)
    return res
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
    return res
  })

export const getCollectionsWithPreview = createServerFn()
  .validator(
    z.object({
      page: z.optional(z.number().default(1)),
      limit: z.optional(z.number().default(12)),
      previewLimit: z.optional(z.number().default(4)),
      type: z.optional(z.enum(['manual', 'producer'])),
    }),
  )
  .handler(async ({ data }) => {
    const { data: listRes, error: listErr } = await api.collections.get({
      query: {
        status: 'published',
        page: data.page,
        limit: data.limit,
        type: data.type,
      },
    })
    elysiaErrorF(listErr)
    if (!listRes?.items?.length) return { items: [], total: 0, page: data.page, limit: data.limit }

    // Fetch previews in batches of 6 to avoid overwhelming the API
    const enriched: Array<typeof listRes.items[number] & { previews: unknown[] }> = []
    const batchSize = 6
    for (let i = 0; i < listRes.items.length; i += batchSize) {
      const batch = listRes.items.slice(i, i + batchSize)
      const results = await Promise.all(
        batch.map(async (col) => {
          const { data: preview, error: prevErr } = await api
            .collections({ id: String(col.id) })
            .preview.get({ query: { limit: data.previewLimit } })
          elysiaErrorF(prevErr)
          return { ...col, previews: preview ?? [] }
        }),
      )
      enriched.push(...results)
    }
    return { items: enriched, total: listRes.total, page: listRes.page, limit: listRes.limit }
  })
