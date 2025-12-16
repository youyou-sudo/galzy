import { api } from '@libs'
import { cacheLife, cacheTag } from 'next/cache'

export const remfGameGet = async () => {
  "use cache"
  cacheTag('homeData', 'homeData-remfGame')
  cacheLife('minutes')
  const { data } = await api.umami.remfGame.get()
  return data ?? []
}

export const remfTagGet = async () => {
  "use cache"
  cacheTag('homeData', 'homeData-remfTagGet')
  cacheLife('minutes')
  const { data } = await api.umami.remfTag.get()
  return data ?? []
}
