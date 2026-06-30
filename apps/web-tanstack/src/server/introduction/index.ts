import { api } from '@libs'
import { createServerFn } from '@tanstack/react-start'
import { elysiaErrorF } from '@web/lib'
import { cookiePass } from '@web/lib/cookie-pass'
import z from 'zod'

export const getIntroductionArticle = createServerFn()
  .validator(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const { data: res, error } = await api.strategy.strategy.get({
      query: {
        strategyId: +data.id,
      },
    })
    elysiaErrorF(error)
    return res
  })

export const getintroductionList = createServerFn()
  .validator(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const { data: res, error } = await api.strategy.gamestrategys.get({
      query: { gameId: data.id },
    })
    elysiaErrorF(error)
    return res
  })

export const createIntroduction = createServerFn()
  .validator(
    z.object({
      gameId: z.string(),
      title: z.string().min(1, '标题不能为空'),
      content: z.string().min(1, '内容不能为空'),
      copyright: z.string().nullable().optional(),
      userid: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const { error } = await api.strategy.strategylistcreate.post(
      {
        id: data.gameId,
        data: {
          title: data.title,
          content: data.content,
          copyright: data.copyright ?? '',
        },
        userid: data.userid,
      },
      cookiePass(),
    )
    elysiaErrorF(error)
    return { success: true }
  })

export const updateIntroduction = createServerFn()
  .validator(
    z.object({
      id: z.string(),
      data: z.object({
        title: z.string().min(1, '标题不能为空'),
        content: z.string().min(1, '内容不能为空'),
        copyright: z.string().nullable().optional(),
      }),
    }),
  )
  .handler(async ({ data }) => {
    const { error } = await api.strategy.strategylistupdate.post(
      {
        id: data.id,
        data: {
          title: data.data.title,
          content: data.data.content,
          copyright: data.data.copyright ?? '',
        },
      },
      cookiePass(),
    )
    elysiaErrorF(error)
    return { success: true }
  })

export const deleteIntroduction = createServerFn()
  .validator(
    z.object({
      strategyId: z.number(),
      gameId: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const { error } = await api.strategy.strategylistdelete.post(
      {
        strategyId: data.strategyId,
        gameId: data.gameId,
      },
      cookiePass(),
    )
    elysiaErrorF(error)
    return { success: true }
  })
