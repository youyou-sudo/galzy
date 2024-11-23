import { title } from "@/components/primitives";
import { vndbmgethome } from "@/lib/vndbdata";
import { Gamelsit } from "@/app/(components)/gamelist";
import { PaginationWithLinks } from "@/components/pagination-with-links";
import Handmotion from "@/components/Handmotion";

interface SearchParams {
  pages?: string;
}

export const dynamic = "force-dynamic";

async function Home({ searchParams }: { searchParams: SearchParams }) {
  const { pages } = await searchParams;
  const gamelistdatas = await vndbmgethome(pages || "1");
  return (
    <>
      <div className="max-w-3xl mx-auto my-auto">
        <Handmotion>
          <div className={title()}>
            Home
            <div className="text-base text-gray-500">
              共收录了 {gamelistdatas.totalCount} 部
            </div>
          </div>
        </Handmotion>
        <Gamelsit datas={gamelistdatas.data} />
      </div>

      <PaginationWithLinks
        page={gamelistdatas.currentPage}
        totalCount={gamelistdatas.totalPages}
      />
    </>
  );
}

export default Home;
