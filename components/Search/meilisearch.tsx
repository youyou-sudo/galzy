import MeiliSearchClient from "@/lib/meilisearch";
import React from "react";

const MeilisearchCard = async ({}) => {
  const search = await MeiliSearchClient.index("steam-videogames").search("");
  return (
    <code>
      <pre>{JSON.stringify(search, null, 2)}</pre>
    </code>
  );
};

export default MeilisearchCard;
