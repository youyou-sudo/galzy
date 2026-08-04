import { Elysia, t } from 'elysia'
import { betterAuth } from '../auth'
import { SearchModel } from './model'
import { Search } from './service'

export const search = new Elysia({ prefix: '/search' })
  .use(betterAuth)
  .get(
    '/',
    async ({ query: { q, limit, startDate, endDate } }) => {
      return Search.get({ q, limit, startDate, endDate })
    },
    {
      query: SearchModel.search,
    },
  )
  .get(
    '/games',
    async ({ query }) => {
      return Search.searchGames(query)
    },
    {
      query: SearchModel.gameSearch,
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
  .get(
    '/tags',
    async ({ query: { q, limit } }) => {
      return Search.searchTags({ q, limit })
    },
    {
      query: SearchModel.tagSearch,
    },
  )
  .get(
    '/producers',
    async ({ query: { q, page, hitsPerPage } }) => {
      return Search.searchProducers({ q, page, hitsPerPage })
    },
    {
      query: SearchModel.producerSearch,
    },
  )
  .get('/getStats', async () => {
    return await Search.getStats()
  })
  .get(
    '/meilisearchEmbeddersGet',
    async () => {
      return await Search.meilisearchEmbeddersGet()
    },
    {
      isAdmin: true,
    },
  )
  .get(
    '/meilisearchPropertylist',
    async ({ query: { indexName } }) => {
      return await Search.meilisearchPropertylist(indexName)
    },
    {
      isAdmin: true,
      query: t.Object({ indexName: t.Optional(t.String()) }),
    },
  )
  .get(
    '/meilisearchSearchableAttributesGet',
    async ({ query: { indexName } }) => {
      return await Search.meilisearchSearchableAttributesGet(indexName)
    },
    {
      isAdmin: true,
      query: t.Object({ indexName: t.Optional(t.String()) }),
    },
  )
  .post(
    '/meilisearchSearchableAttributesUpdate',
    async ({ body: { fields, indexName } }) => {
      return await Search.meilisearchSearchableAttributesUpdate({
        fields,
        indexName,
      })
    },
    {
      isAdmin: true,
      body: SearchModel.meilisearchSearchableAttributesUpdate,
    },
  )
