import { HomeGamelist } from "@/components/home";
import SearchInput from "@/components/search";
import { homeData } from "@/app/(app)/(home)/lib/homeData";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

export default async function Home() {
  const queryClient = new QueryClient();
  await queryClient.prefetchInfiniteQuery({
    queryKey: ["gamelist"],
    queryFn: async ({ pageParam }) => {
      return await homeData(20, pageParam);
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
    <>
      <div className="max-w-3xl justify-center mx-auto">
        <SearchInput />
      </div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <HomeGamelist />
      </HydrationBoundary>
    </>
  );
}
