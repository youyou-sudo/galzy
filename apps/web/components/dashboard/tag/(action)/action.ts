'use server'
import type { TagsModel } from '@api/modules/tags/model'
import { api } from '@libs'

export const tagAllAction = async ({
  pageSize,
  pageIndex,
  id,
  keyword,
}: {
  pageSize: number
  pageIndex: number
  id?: string
  keyword?: string
}) => {
  const { data } = await api.tags.tagall.post({
    id: id || '',
    keyword: keyword || '',
    pageSize,
    pageIndex: pageIndex - 1,
  })
  return data
}

export const tagEditAction = async ({
  id,
  zh_name,
  exhibition,
  zh_alias,
  zh_description,
}: TagsModel.tagEdit) => {
  const { status } = await api.tags.tagedit.post({
    id,
    zh_name,
    exhibition,
    zh_alias,
    zh_description,
  })
  return status
}

export const gameTagsAction = async (file: FormData) => {
  const files = file.get("file") as File
  await api.tags.tagFileUp.post({ file: files });
}

export const TagAllFileDwn = async () => {
  const { data } = await api.tags.tagAllFileDwn.get()
  return data
}
