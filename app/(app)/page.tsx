import { title } from "@/components/primitives";
import { vndbCount, vndbmgethome } from "@/lib/vndbdata";
import { Gamelsit } from "./(components)/gamelist";
import { PaginationWithLinks } from "@/components/ui/pagination-with-links";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

async function Home({ searchParams }: { searchParams: { page: string } }) {
  const { page } = await searchParams;
  const pages = Number(page);
  const queryClient = new QueryClient();
  await queryClient.prefetchInfiniteQuery({
    queryKey: ["gamelist"],
    queryFn: () => vndbmgethome(), // 传入页码
    initialPageParam: 1,
    getNextPageParam: (lastPage: any) => {
      return lastPage.currentPage < lastPage.totalPages
        ? lastPage.currentPage + 1
        : undefined;
    },
  });
  const countData = await vndbCount();
  return (
    <>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <div className="max-w-6xl mx-auto my-auto">
          <div>
            <div className={title()}>
              Home
              <div className="text-base opacity-50">
                共收录了 {countData.totalCount} 部
              </div>
            </div>
          </div>

          <div>
            <Gamelsit />
          </div>
          <div className="mt-4">
            <PaginationWithLinks
              page={pages || 1}
              pageSize={20}
              totalCount={countData.totalCount || 0}
            />
          </div>
        </div>
      </HydrationBoundary>
    </>
  );
}

export default Home;
