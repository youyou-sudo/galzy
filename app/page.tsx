import { title } from "@/components/primitives";
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
        <div>
          <div className={title()}>
            Home
            <div className="text-base text-gray-500">
              共收录了 {allPageData.totalCount} 部
            </div>
          </div>
        </div>
        <div>
          <Gamelistdatasync totalPages={allPageData.totalPages ?? 0} />
        </div>
      </div>
    </>
  );
}

export default Home;
