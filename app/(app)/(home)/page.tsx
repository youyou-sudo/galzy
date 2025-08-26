import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HomeGamelist } from "@/components/home";
import { homeData } from "@/app/(app)/(home)/(action)/homeData";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { metadataConfig } from "@/config/metadata";
import CountComponent from "./(components)/Count";
import SearchInput from "@/components/home/Search/Search";
import { remfTagGet } from "./(action)/remfTag";
import RankingList from "./(components)/remf";
import { remfGameGet } from "./(action)/remfGame";

export const metadata: Metadata = {
  title: "主页",
  description: metadataConfig.description,
};

export async function Home() {
  const queryClient = new QueryClient();
  await queryClient.prefetchInfiniteQuery({
    queryKey: ["gamelist"],
    queryFn: async ({ pageParam }) => {
      return await homeData(24, pageParam);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: {
      currentPage: number;
      totalPages: number;
    }) => {
      return lastPage.currentPage < lastPage.totalPages
        ? lastPage.currentPage + 1
        : null;
    },
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomeGamelist />
    </HydrationBoundary>
  );
}

const Yoyo = () => {
  return (
    <>
      <h1 className="text-6xl font-bold m-0 text-center mt-10">紫缘社</h1>
      <div className="mx-auto mt-3">
        <CountComponent />
      </div>
      <div className="min-w-2/3 mx-auto">
        <SearchInput />
      </div>
      <div className="grid grid-cols-2 gap-4 px-3">
        <Card>
          <CardHeader>
            <CardTitle>热门标签</CardTitle>
            <CardDescription>每周检索最多标签</CardDescription>
          </CardHeader>
          <CardContent>
            <RankingList fetchData={remfTagGet} linkKey="tag" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>热门游戏</CardTitle>
            <CardDescription>每周浏览最多的游戏</CardDescription>
          </CardHeader>
          <CardContent>
            <RankingList fetchData={remfGameGet} linkKey="id" />
          </CardContent>
        </Card>
      </div>
      <div>
        <Home />
      </div>
    </>
  );
};

export default Yoyo;
