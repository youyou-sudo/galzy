import { api } from '@libs'
import { createServerFn } from '@tanstack/react-start'
import { elysiaErrorF } from '@web/lib'
import { format, parseISO } from 'date-fns'
import z from 'zod'
export const SearchSchema = z.object({
  q: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export const getSearch = createServerFn()
  .validator(SearchSchema)
  .handler(async ({ data }) => {
    const { data: gameListData, error } = await api.search.get({
      query: {
        q: data.q || '',
        limit: 100,
        startDate: data.startDate
          ? format(parseISO(data.startDate), 'yyyyMMdd')
          : undefined,
        endDate: data.endDate
          ? format(parseISO(data.endDate), 'yyyyMMdd')
          : undefined,
      },
    })
    elysiaErrorF(error)
    return gameListData
  })
