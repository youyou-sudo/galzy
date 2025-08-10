import { HomeGamelist } from "@/components/home";
import SearchInput from "@/components/Search";
import { homeData } from "@/app/(app)/(home)/lib/homeData";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { Suspense } from "react";
import { GameCard } from "@/components/game-card";

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

const DfPage = () => {
  return (
    <>
      <div className="max-w-3xl justify-center mx-auto">
        <SearchInput />
      </div>
      <Suspense
        fallback={
          <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
            {Array.from({ length: 20 }).map((_, index) => (
              <GameCard.ListSkeleton key={index} />
            ))}
          </div>
        }
      >
        <Home />
      </Suspense>
    </>
  );
};

export default DfPage;
