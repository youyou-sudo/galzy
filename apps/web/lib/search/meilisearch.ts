'use server'
import { api } from '@libs'

export const getSearch = async ({ q, limit }: { q: string; limit: number }) => {
  const { data } = await api.search.get({
    query: { q: q, limit: limit || 100 },
  })
  return data
}
