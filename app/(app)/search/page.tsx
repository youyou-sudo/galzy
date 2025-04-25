import React, { Suspense } from "react";
import { title } from "@/components/primitives";
import { search } from "@/lib/meilisearch/search";
import { Gamelsit } from "@/app/(app)/(components)/gamelist";
import Nodata from "./(components)/nodata";
import type { Metadata } from "next";
import { PaginationWithLinks } from "@/components/ui/pagination-with-links";
import { QueryClient } from "@tanstack/react-query";

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  // read route params
  const { query } = await searchParams;
  return {
    title: `Search - ${query}`,
    description: `搜索页 - ${query}`,
  };
}
type Props = {
  searchParams: {
    query: string;
    pages: string;
  };
};

export async function searchpage({ searchParams }: Props) {
  const { query, pages } = await searchParams;
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["search", query, pages],
    queryFn: () => search(query, pages),
  });
  const qoutput: any = queryClient.getQueryData(["search", query, pages]);
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
        <PaginationWithLinks
          pageSize={50}
          totalCount={qoutput.totalPages}
          page={qoutput.PageNumber}
        />
      </Suspense>
    </div>
  );
}

export default searchpage;
