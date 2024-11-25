import { title } from "@/components/primitives";
import Handmotion from "@/components/Handmotion";
import Gamelistdatasync from "./(components)/gamelistdatasync";
import { getHomeList } from "@/lib/actions/homelist";

interface SearchParams {
  pages?: string;
}

async function Home({ searchParams }: { searchParams: SearchParams }) {
  const { pages } = await searchParams;
  const pagesNumber = Number(pages) || 1;
  const allPageData = await getHomeList(pagesNumber);
  return (
    <>
      <div className="max-w-3xl mx-auto my-auto">
        <Handmotion>
          <div className={title()}>
            Home
            <div className="text-base text-gray-500">
              共收录了 {allPageData.totalCount} 部
            </div>
          </div>
        </Handmotion>
        {/* <Gamelsit datas={allPageData.data} /> */}
        <Gamelistdatasync
          datas={allPageData}
          totalPages={allPageData.totalPages ?? 0}
        />
      </div>
    </>
  );
}

export default Home;
