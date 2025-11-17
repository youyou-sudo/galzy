'use server'
import { api } from '@libs'

export const homeData = async (pageSize: number, pageIndex: number) => {
  "use cache"
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
  const totalCountResult = await api.games.count.get()
  return Number(totalCountResult.data || 0)
}
