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
    const { data: res, error } = await api.collections({ id: data.id }).preview.get({
      query: { limit: data.limit },
    })
    elysiaErrorF(error)
    return res
  })

export const getCollectionsWithPreview = createServerFn()
  .validator(
    z.object({
      limit: z.optional(z.number().default(6)),
      previewLimit: z.optional(z.number().default(4)),
    }),
  )
  .handler(async ({ data }) => {
    const { data: listRes, error: listErr } = await api.collections.get({
      query: { status: 'published', limit: data.limit },
    })
    elysiaErrorF(listErr)
    if (!listRes?.items?.length) return []

    const enriched = await Promise.all(
      listRes.items.map(async (col) => {
        const { data: preview, error: prevErr } = await api
          .collections({ id: String(col.id) })
          .preview.get({ query: { limit: data.previewLimit } })
        elysiaErrorF(prevErr)
        return { ...col, previews: preview ?? [] }
      }),
    )
    return enriched
  })
