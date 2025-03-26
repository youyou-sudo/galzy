import { title } from "@/components/primitives";
import { vndbmgethome, type VndbmgethomeType } from "@/lib/vndbdata";
import { Gamelsit } from "./(components)/gamelist";
import { PaginationWithLinks } from "@/components/ui/pagination-with-links";
import { QueryClient } from "@tanstack/react-query";
import Errors from "@/components/error";

async function Home({ searchParams }: { searchParams: { page: string } }) {
  const { page } = await searchParams;
  const pages = Number(page);
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["HomePages", pages],
    queryFn: () => vndbmgethome(pages),
  });
  const datas = queryClient.getQueryData<VndbmgethomeType>(["HomePages", pages]);
  if (!datas) {
    return (
      <div className="max-w-3xl mx-auto my-auto">
        <Errors
          code="404"
          errormessage={"找不到数据喵～是不是藏起来了？🐱💭✨"}
        />
      </div>
    );
  }
  return (
    <>
      <div className="max-w-3xl mx-auto my-auto">
        <div>
          <div className={title()}>
            Home
            <div className="text-base opacity-50">
              共收录了 {datas.totalCount} 部
            </div>
          </div>
        </div>

        <div>
          <Gamelsit datas={datas.data} />
        </div>
        <div className="mt-4">
          <PaginationWithLinks
            page={pages || 1}
            pageSize={20}
            totalCount={datas.totalCount || 0}
          />
        </div>
      </div>
    </>
  );
}

export default Home;
