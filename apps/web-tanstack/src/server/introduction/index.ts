import { api } from '@libs'
import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { elysiaErrorF } from '@web/lib'

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
