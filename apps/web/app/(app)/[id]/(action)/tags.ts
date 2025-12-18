'use server'
import { api } from '@libs'

export const tagshData = async (id: string) => {
  const { data } = await api.tags.gametags.post({ id })

  return data
}
