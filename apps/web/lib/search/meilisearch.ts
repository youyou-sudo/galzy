'use server'
import { api } from '@libs'
import { cacheLife, cacheTag } from 'next/cache';

export const getSearch = async ({ q, limit }: { q: string; limit: number }) => {
  "use cache"
  cacheTag('getSearch', `${q}`, `${limit}`)
  cacheLife('minutes')
  const { data } = await api.search.get({
    query: { q: q, limit: limit || 100 },
  })
  return data
}
