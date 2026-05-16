import { api } from '@libs'
import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { assertOk } from '#/lib'

export const getIntroductionArticle = createServerFn()
  .inputValidator(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const res = await api.strategy.strategy.get({
      query: {
        strategyId: +data.id,
      },
    })
    return assertOk(res, '文章')
  })

export const getintroductionList = createServerFn()
  .inputValidator(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const res = await api.strategy.gamestrategys.get({
      query: { gameId: data.id },
    })
    return assertOk(res, '攻略列表')
  })
