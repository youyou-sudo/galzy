"use client";
import React from "react";
import { getImageUrl, imageAcc } from "@/lib/ImageUrl";
import { GameCard } from "@/components/game-card";
import { useQuery } from "@tanstack/react-query";
import { getSearch } from "@/lib/search/meilisearch";
import { useQueryState } from "nuqs";
import { HoverPrefetchLink } from "@/components/ui/hover-prefetch-link";
import { TagViewsTrackEvents } from "@/components/umami/track-events";

const SearchlistComponent = () => {
  const [q] = useQueryState("q");

  const { data: gameListData, isPending } = useQuery({
    queryKey: ["search", q],
    queryFn: async () => {
      const response = await getSearch({
        q: q || "",
        limit: 100,
      });
      return response;
    },
  });
  const gameList = () => {
    if (isPending)
      return (
        <>
          <GameCard.ListSkeleton />
          <GameCard.ListSkeleton />
          <GameCard.ListSkeleton />
        </>
      );
    return gameListData?.hits.map((item) => {
      const imageFilter = () => {
        const images =
          item.other &&
          item.other_datas?.other_media.some((item: any) => item.cover === true)
            ? item.other_datas.other_media.find(
                (item: any) => item.cover === true
              )?.media
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
        <HoverPrefetchLink href={`/${item.id}`} key={item.id}>
          <div className="space-y-2 aspect-[2/3] p-0">
            {/* [x] VNDB 来源图片进行缓存以防止滥用 VNDB 服务
             */}
            <GameCard.Image
              width={imagesData.width}
              height={imagesData.height}
              loading="lazy"
              priority={false}
              src={imagess}
              alt="图片"
            />
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
        </HoverPrefetchLink>
      );
    });
  };
  const tagtitle = `[tag:${gameListData?.topTag?.id}]-[${
    gameListData?.topTag?.zh_name || gameListData?.topTag?.name
  }]`;

  return (
    <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
      {gameList()}
      {gameListData?.topTag && <TagViewsTrackEvents tagtitle={tagtitle} />}
    </div>
  );
};

export default SearchlistComponent;
