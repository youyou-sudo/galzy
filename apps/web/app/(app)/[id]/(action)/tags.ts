'use server'
import { api } from '@libs'
import { cacheLife, cacheTag } from 'next/cache'

export const tagshData = async (id: string) => {
  'use cache'
  cacheTag(`gameData-tagshData-${id}`)
  cacheLife('minutes')
  const { data } = await api.tags.gametags.post({ id })

  return data
}
