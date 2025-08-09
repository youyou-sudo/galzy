"use client";
import React, { useEffect } from "react";
import { getImageUrl } from "@/lib/ImageUrl";
import { Link } from "next-view-transitions";
import { useInView } from "react-intersection-observer";
import { GameCard } from "@/components/game-card";
import { useInfiniteQuery } from "@tanstack/react-query";
import { homeData } from "@/app/(app)/(home)/lib/homeData";

const HomeGamelistComponent = () => {
  const {
    data: gameListData,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ["gamelist"],
    queryFn: async ({ pageParam = 0 }) => {
      return await homeData(24, pageParam);
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
  const { ref, inView } = useInView({ threshold: 0 });

  useEffect(() => {
    if (gameListData?.pages.length === 0) {
      refetch();
    }
  }, [refetch, gameListData?.pages.length]);

  useEffect(() => {
    if (inView && !isLoading) {
      fetchNextPage();
    }
  }, [inView, isLoading, fetchNextPage]);

  const gameList = gameListData?.pages.flatMap((page) =>
    page.items.map((item) => (
      <Link href={`/${item.id}`} scroll={true} key={item.id}>
        <div className="space-y-2 aspect-[2/3] p-0">
          {/* [x] VNDB 来源图片进行缓存以防止滥用 VNDB 服务
           */}
          <GameCard.Image
            fill
            src={getImageUrl(item.images)}
            alt="图片"
          />
        </div>
        <p className="text-sm truncate w-full text-center pl-2 pr-2 pt-2">
          {
            item.titles.find((it: { lang: string }) => it.lang === item.olang)
              ?.title
          }
        </p>
      </Link>
    ))
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

export const HomeGamelist = HomeGamelistComponent;
