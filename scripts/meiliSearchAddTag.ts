import { env } from "next-runtime-env";

import { getMeiliSearchClient } from "@/lib/meilisearch";
import { tagAllGet } from "@/lib/Tagall";

export const meiliSearchAddIndex = async () => {
  const meiliClient = await getMeiliSearchClient();
  const index = await meiliClient.index(env("MEILISEARCH_TAG_INDEXNAME")!);
  await index.deleteAllDocuments();

  let pageIndex = 0;
  const pageSize = 500; // 每批 500 条，根据数据量调
  let hasMore = true;

  while (hasMore) {
    const { items, totalPages } = await tagAllGet(pageSize, pageIndex);

    if (items.length > 0) {
      await index.addDocuments(items);
    }

    pageIndex++;
    hasMore = pageIndex < totalPages;
  }
};

meiliSearchAddIndex();
