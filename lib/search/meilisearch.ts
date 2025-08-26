"use server";
import { env } from "next-runtime-env";
import { getMeiliSearchClient } from "../meilisearch";
import { tagAllGet } from "../Tagall";

type tagAllGetType = Awaited<ReturnType<typeof tagAllGet>>;

export const getSearch = async ({
  q,
  limit,
}: {
  q: string;
  limit?: number;
}) => {
  const MeiliClient = await getMeiliSearchClient();
  const index = await MeiliClient.index(env("MEILISEARCH_INDEXNAME")!).search(
    q,
    {
      limit: limit || 50,
    }
  );

  const tagf = await MeiliClient.index(
    env("MEILISEARCH_TAG_INDEXNAME")!
  ).search(q, {
    limit: 1,
  });

  const topTag = tagf.hits[0];
  return {
    hits: index.hits,
    topTag: topTag ? (topTag as tagAllGetType["items"][0]) : undefined,
  };
};
