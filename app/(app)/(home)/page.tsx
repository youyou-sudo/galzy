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
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Gamepad2, InfoIcon, Tags } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "主页",
  description: metadataConfig.description,
};

// 提取 Skeleton 列表，避免重复
const SkeletonList = ({ count = 4 }: { count?: number }) => (
  <>
    {Array.from({ length: count }).map((_, index) => (
      <Skeleton key={index} className="h-[21px] w-full my-2.5" />
    ))}
  </>
);

export async function Home() {
  const queryClient = new QueryClient();
  await queryClient.prefetchInfiniteQuery({
    queryKey: ["gamelist"],
    queryFn: async ({ pageParam }) => await homeData(24, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage: { currentPage: number; totalPages: number }) =>
      lastPage.currentPage < lastPage.totalPages
        ? lastPage.currentPage + 1
        : null,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomeGamelist />
    </HydrationBoundary>
  );
}

const HomePage = () => {
  return (
    <>
      <h1 className="text-6xl font-bold text-center mt-10">紫缘社</h1>
      <div className="mx-auto mt-3">
        <CountComponent />
      </div>
      {/* 搜索框 */}
      <div className="min-w-2/3 mx-auto">
        <SearchInput />
      </div>

      {/* 热门标签 + 热门游戏 */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-3 px-0 md:px-3">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="flex items-center">
              热门标签 <Tags className="w-4 h-4 ml-1 text-red-300" />
            </CardTitle>
            <CardDescription>每周检索最多标签</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<SkeletonList />}>
              <RankingList fetchData={remfTagGet} linkKey="tag" />
            </Suspense>
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="flex items-center">
              热门游戏 <Gamepad2 className="w-4 h-4 ml-1 text-red-300" />
            </CardTitle>
            <CardDescription>每周浏览最多的游戏</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<SkeletonList />}>
              <RankingList fetchData={remfGameGet} linkKey="id" />
            </Suspense>
          </CardContent>
        </Card>
      </div>

      {/* 游戏列表 */}
      <div className="mt-3">
        <Home />
      </div>
    </>
  );
};

export default HomePage;
