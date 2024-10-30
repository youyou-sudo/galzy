import React, { Suspense } from "react";
import { title } from "@/components/primitives";
import { search } from "@/lib/meilisearch/search";
import { Gamelsit } from "@/app/(components)/gamelist";
import { Pag } from "@/components/Pag";
import Nodata from "./(components)/nodata";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search",
  description: "搜索页",
};
type Props = {
  searchParams: {
    query: string;
    pages: string;
  };
};

export async function searchpage({ searchParams }: Props) {
  const { query, pages } = await searchParams;
  metadata.title = `Search ${query}`;
  const qoutput: any = await search(query || "", pages || "1");
  const data = qoutput.hits;
  return (
    <div className="max-w-3xl mx-auto my-auto">
      <div
        className={title()}
        style={{
          display: "flex",
          alignItems: "baseline",
        }}
      >
        Search
        <div className="flex text-base text-gray-500">：{query}</div>
      </div>

      <Suspense>
        {qoutput.hits.length > 0 ? <Gamelsit datas={data} /> : <Nodata />}
        <Pag total={qoutput.totalPages} pages={qoutput.page} />
      </Suspense>
    </div>
  );
}

export default searchpage;
