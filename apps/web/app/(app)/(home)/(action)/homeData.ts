'use server'
import { api } from '@libs'
import { cacheLife, cacheTag } from 'next/cache'

export const homeData = async (pageSize: number, pageIndex: number) => {
  "use cache"
  cacheTag('homeData', 'gamelist', `${pageSize}-${pageIndex}`)
  cacheLife('minutes')
  const { data } = await api.games.gamelist.get({
    query: {
      pageIndex,
      pageSize,
    },
  })
  return data
}

export const totalCountGet = async () => {
  "use cache"
  cacheTag('homeData', 'totalCountGet')
  cacheLife('minutes')
  const totalCountResult = await api.games.count.get()
  return Number(totalCountResult.data || 0)
}
