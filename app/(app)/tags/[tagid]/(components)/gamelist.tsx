"use client";

import React, { useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { GameCard } from "@/components/game-card";
import { getVnListByTag } from "../(acrion)/tagvns";
import { GameItem } from "@/components/home/GameItem";

export const TagsGamelist = ({ tagid }: { tagid: string }) => {
  const { ref, inView } = useInView({ threshold: 0 });

  const {
    data: gameListData,
    isLoading,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ["TagGameList", tagid],
    queryFn: async ({ pageParam = 0 }) => {
      return await getVnListByTag(tagid, 24, pageParam);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: { currentPage: number; totalPages: number }) =>
      lastPage.currentPage < lastPage.totalPages
        ? lastPage.currentPage + 1
        : null,
  });

  // 无限加载触发
  useEffect(() => {
    if (inView && !isLoading && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, isLoading, hasNextPage, fetchNextPage]);
  const gameList = gameListData?.pages.flatMap((page) =>
    page.items.map((item) => <GameItem key={item.id} item={item} />)
  );

  return (
    <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
      {gameList}
      {hasNextPage && (
        <>
          <GameCard.ListSkeleton ref={ref} />
          <GameCard.ListSkeleton />
          <GameCard.ListSkeleton />
        </>
      )}
    </div>
  );
};
