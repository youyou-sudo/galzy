import { HomeGamelist } from "@/components/home";
import { homeData } from "@/app/(app)/(home)/lib/homeData";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

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
      <h1 className="text-6xl font-bold">Home</h1>
      <Home />
    </>
  );
};

export default DfPage;
