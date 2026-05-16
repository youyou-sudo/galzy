import { api } from '@libs'
import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { assertOk } from '#/lib'

export const getTagData = createServerFn()
  .inputValidator(
    z.object({
      tagId: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const res = await api.tags.tag.get({ query: { tagId: data.tagId } })
    return assertOk(res, `${data.tagId} Tag 信息`)
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
    const res = await api.tags.taggames.post({
      tagId: data.tagId,
      pageSize: data.pageSize,
      pageIndex: data.pageIndex,
    })
    return assertOk(res, `${data.tagId} Tag 关联游戏`)
  })
