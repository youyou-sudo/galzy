import { api } from '@libs'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { elysiaErrorF } from '@web/lib'
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
    const cookie = getRequestHeader('Cookie')
    const { data: res, error } = await api.comments.get({
      query: {
        targetType: data.targetType,
        targetId: data.targetId,
        page: data.page,
        limit: data.limit,
        type: data.type,
        status: data.status,
      },
      fetch: {
        headers: {
          cookie: cookie || '',
        },
      },
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
    const cookie = getRequestHeader('Cookie')
    const { data: res, error } = await api.comments.post(
      {
        targetType: data.targetType,
        targetId: data.targetId,
        content: data.content,
        parentId: data.parentId,
        replyToUserId: data.replyToUserId,
        type: data.type,
      },
      {
        fetch: {
          headers: {
            cookie: cookie || '',
          },
        },
      },
    )
    elysiaErrorF(error)
    return res
  })
