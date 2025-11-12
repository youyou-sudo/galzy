import { MeiliClient } from '@api/libs'
import { getKv, setKv } from '@api/libs/redis'
import { status } from 'elysia'
import { t } from 'try'
import type { SearchModel } from './model'

export const Search = {
  async get({ q, limit }: SearchModel.search) {
    const safeQ = q.replace(/[+\-*/=<>!&|%^$#@~?:;'",()[\]{}\\]/g, '').trim()
    const redisData = await getKv(`Search-${safeQ}-${limit}`)

    if (redisData) {
      const parsed = JSON.parse(redisData)
      return parsed as SearchReturn
    }

    const [, error, [index, tagf]] = t(
      await Promise.all([
        MeiliClient.index(process.env.MEILISEARCH_INDEXNAME || '').search(
          safeQ,
          {
            limit: limit || 50,
          },
        ),
        MeiliClient.index(process.env.MEILISEARCH_TAG_INDEXNAME || '').search(
          safeQ,
          {
            limit: 1,
          },
        ),
      ]),
    )
    if (error) {
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    }
    const topTag = tagf.hits[0]
    const data = {
      hits: index.hits,
      topTag: topTag
        ? (topTag as SearchModel.tagAllReturn['items'][0])
        : undefined,
    }
    void setKv(`Search-${safeQ}-${limit}`, JSON.stringify(data), 60 * 60 * 1)
    type SearchReturn = typeof data
    return data
  },
  async meilisearchEmbeddersUpdate({
    url,
    embeddingApiKey,
    model,
    documentTemplateMaxBytes,
    documentTemplate,
  }: SearchModel.meilisearchEmbeddersUpdate) {
    const indexdata = await MeiliClient.index(
      process.env.MEILISEARCH_INDEXNAME!,
    ).updateEmbedders({
      body: {
        source: 'rest',
        url: url,
        headers: { Authorization: embeddingApiKey },
        request: { model: model, input: ['{{text}}', '{{..}}'] },
        documentTemplateMaxBytes: documentTemplateMaxBytes,
        response: {
          data: [
            {
              embedding: '{{embedding}}',
            },
            '{{..}}',
          ],
        },

        documentTemplate: documentTemplate,
      },
    })
    return indexdata
  },
  async meilisearchEmbeddersGet() {
    const indexdata = await MeiliClient.index(
      process.env.MEILISEARCH_INDEXNAME!,
    ).getEmbedders()
    return indexdata
  },
  async meilisearchPropertylist() {
    const indexdata = await MeiliClient.index(
      process.env.MEILISEARCH_INDEXNAME!,
    ).getDocuments({ limit: 1 })
    if (indexdata.results && indexdata.results.length > 0) {
      return Object.keys(indexdata.results[0])
    }
    return []
  },
  async meilisearcSearchableAttributeshGet() {
    const index = MeiliClient.index(process.env.MEILISEARCH_INDEXNAME!)

    const searchable = await index.getSearchableAttributes()

    if (
      Array.isArray(searchable) &&
      searchable.length === 1 &&
      searchable[0] === '*'
    ) {
      return await Search.meilisearchPropertylist()
    }
    return searchable
  },
  async meilisearcSearchableAttributeshUpdate({
    fields,
  }: SearchModel.meilisearcSearchableAttributeshUpdate) {
    const index = MeiliClient.index(process.env.MEILISEARCH_INDEXNAME!)
    await index.updateSearchableAttributes(fields)
  },
  async getStats() {
    const indexdata = await MeiliClient.getStats()
    return indexdata
  },
}
