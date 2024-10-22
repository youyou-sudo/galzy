import { title } from "@/components/primitives";
import { vndbmgethome, vndbCount } from "@/lib/vndbdata";
import { Gamelsit } from "@/app/(components)/gamelist";
import { stringify, parse } from "flatted";
import { Pag } from "@/components/Pag";
import Handmotion from "@/components/Handmotion";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VNGal",
  description: "又又又一个 GalGame 资源站",
};
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
        <Gamelsit datas={gamelistdatas} />
      </div>

      <Pag
        pages={gamelistdatas.currentPage}
        total={gamelistdatas.totalPages}
      ></Pag>
    </>
  );
}

export default Home;
