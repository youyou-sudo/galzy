import { env } from "next-runtime-env";

import { homeData } from "@/app/(app)/(home)/lib/homeData";
import { getMeiliSearchClient } from "@/lib/meilisearch";

export const meiliSearchAddIndex = async () => {
  const meiliClient = await getMeiliSearchClient();
  const index = await meiliClient.index(env("MEILISEARCH_INDEXNAME")!);
  // await index.deleteAllDocuments();

  let pageIndex = 0;
  const pageSize = 500; // 每批 500 条，根据数据量调
  let hasMore = true;

  while (hasMore) {
    const { items, totalPages } = await homeData(pageSize, pageIndex);
    // 格式化数据，MeiliSearch 必须有唯一 id

    if (items.length > 0) {
      const res = await index.addDocuments(items);
      console.log(res);
    }

    pageIndex++;
    hasMore = pageIndex < totalPages;
  }
};

meiliSearchAddIndex();
