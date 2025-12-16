'use server'
import { api } from '@libs'
import { cacheTag } from 'next/cache'

export const getVnDetails = async (id: string) => {
  "use cache"
  cacheTag(`getVnDetails-${id}`)
  const { data } = await api.games.get({
    query: {
      id,
    },
  })
  return data
}
