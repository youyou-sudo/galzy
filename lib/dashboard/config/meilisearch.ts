"use server";
import { getMeiliSearchClient } from "@/lib/meilisearch";
import { env } from "next-runtime-env";

export const meilisearchEmbeddersUpdate = async ({
  url,
  embeddingApiKey,
  model,
  documentTemplateMaxBytes,
  documentTemplate,
}: {
  url: string;
  embeddingApiKey: string;
  model: string;
  documentTemplateMaxBytes: number;
  documentTemplate: string;
}) => {
  const meiliClient = await getMeiliSearchClient();
  const indexdata = await meiliClient
    .index(env("MEILISEARCH_INDEXNAME")!)
    .updateEmbedders({
      body: {
        source: "rest",
        url: url,
        headers: { Authorization: embeddingApiKey },
        request: { model: model, input: ["{{text}}", "{{..}}"] },
        documentTemplateMaxBytes: documentTemplateMaxBytes,
        response: {
          data: [
            {
              embedding: "{{embedding}}",
            },
            "{{..}}",
          ],
        },

        documentTemplate: documentTemplate,
      },
    });
  return indexdata;
};

export const meilisearchEmbeddersGet = async () => {
  const meiliClient = await getMeiliSearchClient();
  const indexdata = await meiliClient
    .index(env("MEILISEARCH_INDEXNAME")!)
    .getEmbedders();
  return indexdata;
};

export const meilisearchPropertylist = async () => {
  const meiliClient = await getMeiliSearchClient();
  const index = meiliClient.index(env("MEILISEARCH_INDEXNAME")!);
  const docs = await index.getDocuments({ limit: 1 });
  if (docs.results && docs.results.length > 0) {
    return Object.keys(docs.results[0]);
  }
  return [];
};

export const meilisearcSearchableAttributeshGet = async () => {
  const meiliClient = await getMeiliSearchClient();
  const index = meiliClient.index(env("MEILISEARCH_INDEXNAME")!);

  const searchable = await index.getSearchableAttributes();

  if (
    Array.isArray(searchable) &&
    searchable.length === 1 &&
    searchable[0] === "*"
  ) {
    return await meilisearchPropertylist();
  }
  return searchable;
};

export const meilisearcSearchableAttributeshUpdate = async ({
  fields,
}: {
  fields: string[];
}) => {
  try {
    const meiliClient = await getMeiliSearchClient();
    const index = meiliClient.index(env("MEILISEARCH_INDEXNAME")!);
    await index.updateSearchableAttributes(fields);
  } catch (e) {
    throw e;
  }
};
