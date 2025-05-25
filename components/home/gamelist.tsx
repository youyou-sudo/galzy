"use client";
import React, { useEffect } from "react";
import { getImageUrl } from "@/lib/ImageUrl";
import { Link } from "next-view-transitions";
import { useInView } from "react-intersection-observer";
import { GameCard } from "@/components/game-card";
import { useGameListStore } from "@/stores/gameListStore";

const HomeGamelistComponent = () => {
  const { pages, fetchNext, loading } = useGameListStore();
  const { ref, inView } = useInView({ threshold: 0 });

  useEffect(() => {
    if (pages.length === 0) {
      fetchNext();
    }
  }, [fetchNext, pages.length]);

  useEffect(() => {
    if (inView && !loading) {
      fetchNext();
    }
  }, [inView, loading, fetchNext]);

  const gameList = pages.flatMap((page) =>
    page.items.map((item) => (
      <Link href={`/${item.id}`} scroll={true} key={item.id}>
        <div className="space-y-2 aspect-[2/3] p-0">
          <GameCard.Image
            unoptimized
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

  const currentPage =
    pages.length > 0 ? pages[pages.length - 1].currentPage : 0;
  const totalPages = pages.length > 0 ? pages[pages.length - 1].totalPages : 1;
  const isLastPage = currentPage >= totalPages - 1;

  return (
    <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
      {gameList}
      {!isLastPage && (
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
