import { api } from '@libs'
import { createServerFn } from '@tanstack/react-start'
import { elysiaErrorF } from '@web/lib'
import { cookiePass } from '@web/lib/cookie-pass'
import z from 'zod'

export const adminGetComments = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      page: z.optional(z.number()),
      limit: z.optional(z.number()),
      targetType: z.optional(z.string()),
      targetId: z.optional(z.string()),
      type: z.optional(z.string()),
      status: z.optional(z.string()),
    }),
  )
  .handler(async ({ data }) => {
    const { data: res, error } = await api.comments.get({
      query: {
        page: data.page,
        limit: data.limit,
        targetType: data.targetType,
        targetId: data.targetId,
        type: data.type,
        status: data.status,
      },
      ...cookiePass(),
    })
    elysiaErrorF(error)
    return res
  })

export const adminUpdateComment = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: z.string(),
      content: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const { data: res, error } = await api
      .comments({ id: data.id })
      .put({ content: data.content }, cookiePass())
    elysiaErrorF(error)
    return res
  })

export const adminDeleteComment = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { data: res, error } = await api
      .comments({ id: data.id })
      .delete(undefined, cookiePass())
    elysiaErrorF(error)
    return res
  })

export const adminChangeCommentStatus = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: z.string(),
      status: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const { data: res, error } = await api
      .comments({ id: data.id })
      .status.patch({ status: data.status }, cookiePass())
    elysiaErrorF(error)
    return res
  })

export const adminTogglePin = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { data: res, error } = await api
      .comments({ id: data.id })
      .pin.patch(undefined, cookiePass())
    elysiaErrorF(error)
    return res
  })
