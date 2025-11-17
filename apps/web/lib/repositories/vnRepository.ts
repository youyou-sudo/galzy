'use server'
import { api } from '@libs'

export const getVnDetails = async (id: string) => {
  'use cache'
  const { data } = await api.games.get({
    query: {
      id,
    },
  })
  return data
}
