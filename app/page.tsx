import { title } from "@/components/primitives";
import Gamelistdatasync from "./(components)/gamelistdatasync";
import { getHomeList } from "@/lib/actions/homelist";
import * as motion from "motion/react-client";

async function Home() {
  const allPageData = await getHomeList(2);
  return (
    <>
      <div className="max-w-3xl mx-auto my-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div>
            <div className={title()}>
              Home
              <div className="text-base text-gray-500">
                共收录了 {allPageData.totalCount} 部
              </div>
            </div>
          </div>
        </motion.div>

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
