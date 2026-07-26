import { api } from '@libs'
import { createServerFn } from '@tanstack/react-start'
import { cookiePass } from '@web/lib/cookie-pass'
import { elysiaErrorF } from '@web/lib/elysia-error'
import z from 'zod'

export const adminGetCollections = createServerFn()
  .validator(
    z.object({
      page: z.optional(z.number()),
      limit: z.optional(z.number()),
      status: z.optional(z.string()),
    }),
  )
  .handler(async ({ data }) => {
    const query: Record<string, unknown> = {
      page: data.page,
      limit: data.limit,
    }
    if (data.status && data.status !== '__all__') {
      query.status = data.status
    }
    const { data: res, error } = await api.collections.get({
      query,
      ...cookiePass(),
    })
    elysiaErrorF(error)
    return res
  })

export const adminCreateCollection = createServerFn()
  .validator(
    z.object({
      title: z.string().min(1),
      description: z.optional(z.string()),
      type: z.optional(z.string()),
      producerIds: z.optional(z.array(z.string())),
      status: z.optional(z.string()),
    }),
  )
  .handler(async ({ data }) => {
    const { error } = await api.collections.post(data, cookiePass())
    elysiaErrorF(error)
    return { success: true }
  })

export const adminUpdateCollection = createServerFn()
  .validator(
    z.object({
      id: z.number(),
      title: z.optional(z.string()),
      description: z.optional(z.string()),
      type: z.optional(z.string()),
      producerIds: z.optional(z.array(z.string())),
      status: z.optional(z.string()),
      sortOrder: z.optional(z.number()),
    }),
  )
  .handler(async ({ data }) => {
    const { id, ...rest } = data
    const { error } = await api
      .collections({ id: String(id) })
      .put(rest, cookiePass())
    elysiaErrorF(error)
    return { success: true }
  })

export const adminDeleteCollection = createServerFn()
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const { error } = await api
      .collections({ id: String(data.id) })
      .delete(undefined, cookiePass())
    elysiaErrorF(error)
    return { success: true }
  })

export const adminUpdateCollectionEntries = createServerFn()
  .validator(
    z.object({
      id: z.number(),
      entries: z.array(z.object({ vid: z.string(), sortOrder: z.number() })),
    }),
  )
  .handler(async ({ data }) => {
    const { error } = await api
      .collections({ id: String(data.id) })
      .entries.put({ entries: data.entries }, cookiePass())
    elysiaErrorF(error)
    return { success: true }
  })

export const adminSearchProducers = createServerFn()
  .validator(
    z.object({
      q: z.string().min(1),
      limit: z.optional(z.number()),
    }),
  )
  .handler(async ({ data }) => {
    const { data: res, error } = await api.producer.search.get({
      query: { q: data.q, limit: data.limit },
      ...cookiePass(),
    })
    elysiaErrorF(error)
    return res
  })

export const adminSearchGames = createServerFn()
  .validator(
    z.object({
      q: z.string().min(1),
      limit: z.optional(z.number()),
    }),
  )
  .handler(async ({ data }) => {
    const { data: res, error } = await api.games['quick-search'].get({
      query: { q: data.q, limit: data.limit },
      ...cookiePass(),
    })
    elysiaErrorF(error)
    return res
  })
