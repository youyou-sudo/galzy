import { api } from '@libs'
import { createServerFn } from '@tanstack/react-start'
import { elysiaErrorF } from '@web/lib'
import { cookiePass } from '@web/lib/cookie-pass'
import z from 'zod'

export const getCmments = createServerFn()
  .inputValidator(
    z.object({
      targetType: z.string(),
      targetId: z.string(),
      page: z.optional(z.number()),
      limit: z.optional(z.number()),
      type: z.optional(z.string()),
      status: z.optional(z.string()),
    }),
  )
  .handler(async ({ data }) => {
    const { data: res, error } = await api.comments.get({
      query: {
        targetType: data.targetType,
        targetId: data.targetId,
        page: data.page,
        limit: data.limit,
        type: data.type,
        status: data.status,
      },
      ...cookiePass,
    })
    elysiaErrorF(error)
    return res
  })

export const createCmments = createServerFn()
  .inputValidator(
    z.object({
      targetType: z.string(),
      targetId: z.string(),
      content: z.string(),
      parentId: z.optional(z.string()),
      replyToUserId: z.optional(z.string()),
      type: z.optional(z.string()),
    }),
  )
  .handler(async ({ data }) => {
    const { data: res, error } = await api.comments.post(
      {
        targetType: data.targetType,
        targetId: data.targetId,
        content: data.content,
        parentId: data.parentId,
        replyToUserId: data.replyToUserId,
        type: data.type,
      },
      cookiePass,
    )
    elysiaErrorF(error)
    return res
  })
