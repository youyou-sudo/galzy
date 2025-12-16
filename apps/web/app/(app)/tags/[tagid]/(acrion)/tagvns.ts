'use server'

import { api } from '@libs'
import { cacheLife, cacheTag } from 'next/cache'

export const getTagData = async (tagsid: string) => {
  'use cache'
  cacheTag(`tagData-${tagsid}`)
  cacheLife('hours')
  const { data } = await api.tags.tag.get({ query: { tagId: tagsid } })
  return data
}

export const getVnListByTag = async (
  tagsid: string,
  pageSize: number,
  pageIndex: number,
) => {
  'use cache'
  cacheTag(`tagData-${tagsid}`, `tagData-taggames-${tagsid}-${pageSize}-${pageIndex}`)
  cacheLife('hours')
  const { data } = await api.tags.taggames.post({
    tagId: tagsid,
    pageSize,
    pageIndex,
  })
  return data
}
