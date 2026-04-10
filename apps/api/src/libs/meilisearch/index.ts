import { Meilisearch } from 'meilisearch'

let meiliClient: Meilisearch | null = null

async function getMeiliSearchClient() {
  if (!meiliClient) {
    meiliClient = new Meilisearch({
      host: process.env.MEILISEARCH_HOST!,
      apiKey: process.env.MEILISEARCH_MASTER,
    })
  }
  return meiliClient
}

export const MeiliClient = await getMeiliSearchClient()
