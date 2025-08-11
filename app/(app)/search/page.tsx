import React from "react";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

import SearchlistComponent from "@/components/home/Search/meilisearch";
import { getSearch } from "@/lib/search/meilisearch";

// [x] 用户端搜索
export default async function Pages({
  searchParams,
}: {
  searchParams: { q: string; ai: string };
}) {
  const { q, ai } = await searchParams;
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["search", q, ai],
    queryFn: async () => {
      const response = await getSearch({
        q: q || "",
        ai: ai === "true" ? true : false,
        limit: 100,
      });
      return response;
    },
  });
  return (
    <div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <SearchlistComponent />
      </HydrationBoundary>
    </div>
  );
}
