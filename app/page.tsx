import { title } from "@/components/primitives";
import { vndbmgethome } from "@/lib/vndbdata";
import { Gamelsit } from "@/app/(components)/gamelist";
import { stringify, parse } from "flatted";
import { PaginationWithLinks } from "@/components/pagination-with-links";
import Handmotion from "@/components/Handmotion";

interface SearchParams {
  pages?: string;
}

async function Home({ searchParams }: { searchParams: SearchParams }) {
  const { pages } = await searchParams;
  const dataget = await vndbmgethome(pages || "1");
  const gamelistdatas = await parse(stringify(dataget));
  return (
    <>
      <div className="max-w-3xl mx-auto my-auto">
        <Handmotion>
          <div className={title()}>
            Home
            <div className="text-base text-gray-500">
              共收录了 {gamelistdatas.totalDocuments} 部
            </div>
          </div>
        </Handmotion>
        <Gamelsit datas={gamelistdatas.data} />
      </div>

      <PaginationWithLinks
        page={gamelistdatas.currentPage}
        totalCount={gamelistdatas.totalPages}
      ></PaginationWithLinks>
    </>
  );
}

export default Home;
