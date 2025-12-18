'use server'
import { api } from '@libs'

export const getVnDetails = async (id: string) => {
  const { data } = await api.games.get({
    query: {
      id,
    },
  })
  return data
}
