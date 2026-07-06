import { api } from '@libs'
import { createServerFn } from '@tanstack/react-start'
import { elysiaErrorF } from '@web/lib'
import { cookiePass } from '@web/lib/cookie-pass'
import z from 'zod'

export const adminGetAllArticles = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      page: z.optional(z.number()),
      limit: z.optional(z.number()),
      status: z.optional(z.string()),
      type: z.optional(z.string()),
      search: z.optional(z.string()),
    }),
  )
  .handler(async ({ data }) => {
    const { data: res, error } = await api.strategy.admin.articles.get({
      query: {
        page: data.page,
        limit: data.limit,
        status: data.status,
        type: data.type,
        search: data.search,
      },
      ...cookiePass(),
    })
    elysiaErrorF(error)
    return res
  })

export const adminUpdateArticle = createServerFn()
  .validator(
    z.object({
      id: z.number(),
      title: z.optional(z.string()),
      content: z.optional(z.string()),
    }),
  )
  .handler(async ({ data }) => {
    const { error } = await api.strategy.strategylistupdate.post(
      {
        id: String(data.id),
        data: {
          title: data.title,
          content: data.content,
        },
      },
      cookiePass(),
    )
    elysiaErrorF(error)
    return { success: true }
  })

export const adminDeleteArticle = createServerFn()
  .validator(
    z.object({
      strategyId: z.number(),
      gameId: z.optional(z.string()),
    }),
  )
  .handler(async ({ data }) => {
    const { error } = await api.strategy.strategylistdelete.post(
      {
        strategyId: data.strategyId,
        gameId: data.gameId ?? '',
      },
      cookiePass(),
    )
    elysiaErrorF(error)
    return { success: true }
  })

export const adminChangeArticleStatus = createServerFn()
  .validator(
    z.object({
      id: z.number(),
      status: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const { error } = await api.strategy.admin.articles.status.post(
      { id: data.id, status: data.status },
      cookiePass(),
    )
    elysiaErrorF(error)
    return { success: true }
  })
