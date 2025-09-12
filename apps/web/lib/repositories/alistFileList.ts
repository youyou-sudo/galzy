'use server'
import { api } from '@libs'

export interface TreeNode {
  id: string
  name: string
  type: 'folder' | 'file'
  size?: string
  format?: string
  children?: TreeNode[]
  sign?: string
}

export const getFileList = async (id: string) => {
  const { data } = await api.games.openlistfiles.get({ query: { id } })
  return data
}
