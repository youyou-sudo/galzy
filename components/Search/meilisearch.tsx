import MeiliSearchClient from "@/lib/meilisearch";
import { env } from "next-runtime-env";
import React from "react";

const MeilisearchCard = async ({}) => {
  const search = await MeiliSearchClient.index(
    env("MEILISEARCH_INDEXNAME")!
  ).search("");
  return (
    <code>
      <pre>{JSON.stringify(search, null, 2)}</pre>
    </code>
  );
};

export default MeilisearchCard;
