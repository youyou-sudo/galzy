"use client";
import React, { useEffect } from "react";
import { getImageUrl, imageAcc } from "@/lib/ImageUrl";
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
    page.items.map((item) => {
      const imageFilter = () => {
        const images =
          item.other &&
          item.other_datas?.other_media.some((item) => item.cover === true)
            ? item.other_datas.other_media.find((item) => item.cover === true)
                ?.media
            : item.images;
        return images;
      };
      const imagesData = imageFilter();
      const imagess =
        imagesData && typeof imagesData === "object" && "hash" in imagesData
          ? imageAcc(imagesData.name)
          : getImageUrl({
              imageId: imagesData!.id,
              width: imagesData!.width,
              height: imagesData!.height,
            });
      return (
        <Link href={`/${item.id}`} key={item.id}>
          <div className="space-y-2 aspect-[2/3] p-0">
            {/* [x] VNDB 来源图片进行缓存以防止滥用 VNDB 服务
             */}
            <GameCard.Image fill src={imagess} alt="图片" />
          </div>
          <p className="text-sm truncate w-full text-center pl-2 pr-2 pt-2">
            {item.other_datas?.title?.length
              ? item.other_datas.title.find(
                  (it: { lang: string }) => it.lang === "zh-Hans"
                )?.title ?? item.other_datas.title[0]?.title
              : item.titles.find(
                  (it: { lang: string }) => it.lang === item.olang
                )?.title}
          </p>
        </Link>
      );
    })
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
