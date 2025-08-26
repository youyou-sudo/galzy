import React from "react";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

import SearchlistComponent from "@/components/home/Search/meilisearch";
import { getSearch } from "@/lib/search/meilisearch";
import { Metadata } from "next/types";
import SearchInput from "@/components/home/Search/Search";
import { GamepadIcon } from "lucide-react";

type Props = {
  searchParams: Promise<{ q: string }>;
};

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: `搜索 -  ${q || "游戏"}`,
    description: `搜索 - ${q || "游戏"} 搜索结果`,
  };
}

// [x] 用户端搜索
export default async function Pages({ searchParams }: Props) {
  const { q } = await searchParams;
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["search", q],
    queryFn: async () => {
      const response = await getSearch({
        q: q || "",
        limit: 100,
      });
      return response;
    },
  });
  return (
    <div className="min-h-screen space-y-8">
      <div className="flex items-center justify-center gap-2 mb-4">
        <GamepadIcon className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">游戏搜索</h1>
      </div>
      <SearchInput />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <SearchlistComponent />
      </HydrationBoundary>
    </div>
  );
}
