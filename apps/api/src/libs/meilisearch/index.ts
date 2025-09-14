import { MeiliSearch } from 'meilisearch'

let meiliClient: MeiliSearch | null = null

async function getMeiliSearchClient() {
  if (!meiliClient) {
    meiliClient = new MeiliSearch({
      host: process.env.MEILISEARCH_HOST!,
      apiKey: process.env.MEILISEARCH_MASTER,
    })
  }
  return meiliClient
}

export const MeiliClient = await getMeiliSearchClient()
