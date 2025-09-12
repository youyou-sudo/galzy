'use server'
import { api } from '@libs'

export const meilisearchEmbeddersUpdate = async ({
  url,
  embeddingApiKey,
  model,
  documentTemplateMaxBytes,
  documentTemplate,
}: {
  url: string
  embeddingApiKey: string
  model: string
  documentTemplateMaxBytes: number
  documentTemplate: string
}) => {
  const { data } = await api.search.meilisearchEmbeddersUpdate.post(
    {
      url: url,
      embeddingApiKey: embeddingApiKey,
      model: model,
      documentTemplateMaxBytes: documentTemplateMaxBytes,
      documentTemplate: documentTemplate
    }
  )
  return data
}

export const meilisearchEmbeddersGet = async () => {
  const { data } = await api.search.meilisearchEmbeddersGet.get()
  return data
}

export const meilisearchPropertylist = async () => {
  const { data } = await api.search.meilisearchPropertylist.get()
  return data
}

export const meilisearcSearchableAttributeshGet = async () => {
  const { data } = await api.search.meilisearcSearchableAttributeshGet.get()
  return data
}

export const meilisearcSearchableAttributeshUpdate = async ({
  fields,
}: {
  fields: string[]
}) => {
  const { data } = await api.search.meilisearcSearchableAttributeshUpdate.post({
    fields: fields,
  })
  return data
}
