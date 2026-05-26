import { api } from '@libs'
import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { elysiaErrorF } from '#/lib'

export const getTagData = createServerFn()
  .inputValidator(
    z.object({
      tagId: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const { data: res, error } = await api.tags.tag.get({
      query: { tagId: data.tagId },
    })
    elysiaErrorF(error)
    return res
  })

export const getVnListByTag = createServerFn()
  .inputValidator(
    z.object({
      tagId: z.string(),
      pageSize: z.number(),
      pageIndex: z.number(),
    }),
  )
  .handler(async ({ data }) => {
    const { data: res, error } = await api.tags.taggames.post({
      tagId: data.tagId,
      pageSize: data.pageSize,
      pageIndex: data.pageIndex,
    })
    elysiaErrorF(error)
    return res
  })
