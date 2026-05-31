import { Elysia } from 'elysia'
import { SearchModel } from './model'
import { Search } from './service'

export const search = new Elysia({ prefix: '/search' })
  .get(
    '/',
    async ({ query: { q, limit, startDate, endDate } }) => {
      return Search.get({ q, limit, startDate, endDate })
    },
    {
      query: SearchModel.search,
    },
  )
  .post(
    '/meilisearchEmbeddersUpdate',
    async ({
      body: {
        url,
        embeddingApiKey,
        model,
        documentTemplateMaxBytes,
        documentTemplate,
      },
    }) => {
      return await Search.meilisearchEmbeddersUpdate({
        url,
        embeddingApiKey,
        model,
        documentTemplateMaxBytes,
        documentTemplate,
      })
    },
    {
      isAdmin: true,
      body: SearchModel.meilisearchEmbeddersUpdate,
    },
  )
  .get('/getStats', async () => {
    return await Search.getStats()
  })
  .get('/meilisearchEmbeddersGet', async () => {
    return await Search.meilisearchEmbeddersGet()
  })
  .get('/meilisearchPropertylist', async () => {
    return await Search.meilisearchPropertylist()
  })
  .get('/meilisearcSearchableAttributeshGet', async () => {
    return await Search.meilisearcSearchableAttributeshGet()
  })
  .post(
    '/meilisearcSearchableAttributeshUpdate',
    async ({ body: { fields } }) => {
      return await Search.meilisearcSearchableAttributeshUpdate({ fields })
    },
    {
      isAdmin: true,
      body: SearchModel.meilisearcSearchableAttributeshUpdate,
    },
  )
