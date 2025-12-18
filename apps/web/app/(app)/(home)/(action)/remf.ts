import { api } from '@libs'

export const remfGameGet = async () => {
  const { data } = await api.umami.remfGame.get()
  return data ?? []
}

export const remfTagGet = async () => {
  const { data } = await api.umami.remfTag.get()
  return data ?? []
}
