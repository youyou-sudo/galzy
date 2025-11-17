import { api } from '@libs'

export const remfGameGet = async () => {
  "use cache"
  const { data } = await api.umami.remfGame.get()
  return data ?? []
}

export const remfTagGet = async () => {
  "use cache"
  const { data } = await api.umami.remfTag.get()
  return data ?? []
}
