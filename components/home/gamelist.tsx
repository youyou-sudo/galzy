"use client";

import React, { useEffect, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { getImageUrl, imageAcc } from "@/lib/ImageUrl";
import { GameCard } from "@/components/game-card";
import { homeData } from "@/app/(app)/(home)/lib/homeData";
import { HoverPrefetchLink } from "../ui/hover-prefetch-link";

// 小组件：单个游戏卡片
const GameItem = ({ item }: { item: any }) => {
  const imagesData = useMemo(() => {
    if (item.other && item.other_datas?.other_media?.length) {
      return item.other_datas.other_media.find((m: any) => m.cover)?.media ?? item.images;
    }
    return item.images;
  }, [item]);

  const imagess = useMemo(() => {
    if (!imagesData) return "";
    if ("hash" in imagesData) return imageAcc(imagesData.name);
    return getImageUrl({
      imageId: imagesData.id,
      width: imagesData.width,
      height: imagesData.height,
    });
  }, [imagesData]);

  const title = useMemo(() => {
    return (
      item.other_datas?.title?.find((t: any) => t.lang === "zh-Hans" && t.title.trim() !== "")?.title ||
      item.titles?.find((t: any) => t.lang === item.olang && t.title.trim() !== "")?.title
    );
  }, [item]);

  return (
    <HoverPrefetchLink href={`/${item.id}`}>
      <div className="space-y-2 aspect-[2/3] p-0">
        <GameCard.Image sizes="(max-width: 768px) 100vw, 600px" fill src={imagess} alt={title || "图片"} />
      </div>
      <p className="text-sm truncate w-full text-center pl-2 pr-2 pt-2">{title}</p>
    </HoverPrefetchLink>
  );
};

export const HomeGamelist = () => {
  const { ref, inView } = useInView({ threshold: 0 });

  const {
    data: gameListData,
    isLoading,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ["gamelist"],
    queryFn: async ({ pageParam = 0 }) => {
      return await homeData(24, pageParam);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: { currentPage: number; totalPages: number }) =>
      lastPage.currentPage < lastPage.totalPages ? lastPage.currentPage + 1 : null,
  });

  // 无限加载触发
  useEffect(() => {
    if (inView && !isLoading && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, isLoading, hasNextPage, fetchNextPage]);

  // 扁平化游戏列表
  const gameList = useMemo(() => {
    return gameListData?.pages.flatMap((page) => page.items.map((item) => <GameItem key={item.id} item={item} />));
  }, [gameListData]);

  return (
    <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
      {gameList}
      {hasNextPage && <GameCard.ListSkeleton ref={ref} />}
    </div>
  );
};
