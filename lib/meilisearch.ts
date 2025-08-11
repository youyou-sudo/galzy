"use server";

import { MeiliSearch } from "meilisearch";
import { env } from "next-runtime-env";

let meiliClient: MeiliSearch | null = null;

export async function getMeiliSearchClient() {
  if (!meiliClient) {
    meiliClient = new MeiliSearch({
      host: env("MEILISEARCH_HOST")!,
      apiKey: env("MEILISEARCH_MASTER"),
    });
  }
  return meiliClient;
}
