'use server'
import type { GameModel } from '@api/modules/games/model'
import { api } from '@libs'

export const getFileList = async (id: string) => {
  const { data } = await api.games.openlistfiles.get({ query: { id } })
  return data as GameModel.TreeNode[]
}


export const getFileList2 = async (id: string) => {
  const { data } = await api.games.count.get({ query: { id } })
  return data
}
