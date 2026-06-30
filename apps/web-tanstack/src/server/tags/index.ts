import { api } from '@libs'
import { createServerFn } from '@tanstack/react-start'
import { elysiaErrorF } from '@web/lib'
import z from 'zod'

export const getTagData = createServerFn()
  .validator(
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
  .validator(
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
