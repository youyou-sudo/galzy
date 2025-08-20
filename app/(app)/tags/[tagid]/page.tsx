import React from "react";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BBCodeRenderer } from "@/components/bbcode";
import { getTagData, getVnListByTag } from "./(acrion)/tagvns";
import { TagsGamelist } from "./(components)/gamelist";

export default async function page({ params }: { params: { tagid: string } }) {
  const { tagid } = await params;
  const tag = await getTagData(tagid);

  const queryClient = new QueryClient();
  await queryClient.prefetchInfiniteQuery({
    queryKey: ["TagGameList", tagid],
    queryFn: async ({ pageParam }) => {
      return await getVnListByTag(tagid, 24, pageParam);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: {
      currentPage: number;
      totalPages: number;
    }) => {
      return lastPage.currentPage < lastPage.totalPages
        ? lastPage.currentPage + 1
        : null;
    },
  });

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-center items-center">
            {tag?.zht_name || tag?.name}
          </CardTitle>
          <CardContent className="mt-2">
            <BBCodeRenderer
              text={tag?.zht_description || tag?.description || ""}
            />
          </CardContent>
        </CardHeader>
      </Card>
      <div className="text-sm text-center items-center opacity-30 italic">
        数据过滤，来自 VNDB
      </div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <TagsGamelist tagid={tagid} />
      </HydrationBoundary>
    </div>
  );
}
