'use server'

import { api } from '@libs'

export const getTagData = async (tagsid: string) => {
  const { data } = await api.tags.tag.get({ query: { tagId: tagsid } })
  return data
}

export const getVnListByTag = async (
  tagsid: string,
  pageSize: number,
  pageIndex: number,
) => {
  const { data } = await api.tags.taggames.post({
    tagId: tagsid,
    pageSize,
    pageIndex,
  })
  return data
}
