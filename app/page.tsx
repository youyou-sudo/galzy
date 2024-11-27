import { title } from "@/components/primitives";
import Gamelistdatasync from "./(components)/gamelistdatasync";
import { getHomeList } from "@/lib/actions/homelist";

async function Home() {
  const allPageData = await getHomeList(2);
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
          <Gamelistdatasync
            datas={allPageData}
            totalPages={allPageData.totalPages ?? 0}
          />
        </div>
      </div>
    </>
  );
}

export default Home;
