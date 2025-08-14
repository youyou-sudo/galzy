"use server";
import { env } from "next-runtime-env";
import { getMeiliSearchClient } from "../meilisearch";

export const getSearch = async ({
  q,
  ai,
  limit,
}: {
  q: string;
  ai: boolean;
  limit?: number;
}) => {
  const MeiliClient = await getMeiliSearchClient();
  const index = await MeiliClient.index(env("MEILISEARCH_INDEXNAME")!).search(
    q,
    {
      limit: limit || 20,
      ...(ai
        ? {
            hybrid: {
              embedder: "body",
            },
          }
        : {}),
    }
  );
  return index;
};
