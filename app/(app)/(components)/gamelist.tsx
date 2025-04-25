"use client";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import MontionWhileHover from "@/components/motion/whileHover";
import { cn } from "@/lib/utils";
import { getImageUrl } from "@/lib/ImageUrl";
import { vndbmgethome } from "@/lib/vndbdata";
import { useEffect, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";

export function Gamelsit() {
  const [layout, setLayout] = useState<"grid" | "row" | "block">(() => {
    // Get from localStorage or default to "grid"
    if (typeof window !== "undefined") {
      return (
        (localStorage.getItem("layout") as "grid" | "row" | "block") || "grid"
      );
    }
    return "grid";
  });

  // Update localStorage when layout changes
  useEffect(() => {
    localStorage.setItem("layout", layout);
  }, [layout]);

  const fetchProjects = async ({ pageParam }: { pageParam: number }) => {
    const res = await vndbmgethome(pageParam);
    return res;
  };

  const {
    data: datas,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["gamelist"],
    queryFn: fetchProjects,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      return lastPage.currentPage < lastPage.totalCount
        ? lastPage.currentPage + 1
        : undefined; // 如果超过总页数，则返回 undefined，表示没有更多数据
    },
  });

  return (
    <>
      <div className="flex justify-end mb-4">
        <div className="inline-flex rounded-lg border p-1 bg-muted/60">
          <button
            className={cn(
              "px-3 py-1.5 text-sm rounded-md transition-colors",
              layout === "grid" ? "bg-background" : "hover:bg-background"
            )}
            onClick={() => setLayout("grid")}
          >
            瀑布流
          </button>
          <button
            className={cn(
              "px-3 py-1.5 text-sm rounded-md transition-colors",
              layout === "block" ? "bg-background" : "hover:bg-background"
            )}
            onClick={() => setLayout("block")}
          >
            块式
          </button>
          <button
            className={cn(
              "px-3 py-1.5 text-sm rounded-md transition-colors",
              layout === "row" ? "bg-background" : "hover:bg-background"
            )}
            onClick={() => setLayout("row")}
          >
            行式
          </button>
        </div>
      </div>

      <div
        className={cn(
          "transition-all duration-300",
          layout === "grid" &&
            "grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6",
          layout === "row" && "flex flex-col space-y-2",
          layout === "block" && "grid grid-cols-1 md:grid-cols-2 gap-4"
        )}
      >
        {datas?.pages.map((page) =>
          page.data.map((gamelistdata) => (
            <Link href={`/${gamelistdata.vnid}`} key={gamelistdata.vnid}>
              <MontionWhileHover>
                <Card
                  className={cn(
                    "h-full overflow-hidden transition-all duration-300",
                    "border hover:border-primary/50 hover:shadow-sm p-0.5",
                    layout === "row" && "flex"
                  )}
                >
                  <CardContent
                    className={cn(
                      "p-0 transition-all duration-300",
                      layout === "row" && "flex p-1",
                      layout === "block" && "flex p-1 flex-nowrap flex-row"
                    )}
                  >
                    <div
                      className={cn(
                        "relative transition-all duration-300 group  rounded-lg",
                        layout === "grid" && "w-full pb-[140%]",
                        layout === "block" && "w-24 h-36",
                        layout === "row" && "w-16 h-24"
                      )}
                    >
                      {/* 图片加载占位 */}
                      <div
                        className={cn(
                          "bg-gray-500/50 animate-pulse rounded-lg absolute inset-0",
                          layout === "grid" && "w-full pb-[140%]",
                          layout === "block" && "w-24 h-36",
                          layout === "row" && "w-16 h-24"
                        )}
                      />
                      {/* 图片 */}
                      <Image
                        unoptimized
                        className="rounded-lg object-cover absolute transition-all duration-300"
                        fill
                        sizes={
                          layout === "grid"
                            ? "(max-width: 1200px) 20vw, (max-width: 768px) 25vw, 33vw"
                            : ""
                        }
                        src={getImageUrl(
                          gamelistdata.image,
                          gamelistdata.imagesData
                        )}
                        alt="图片"
                      />
                      {layout === "grid" && (
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t pt-30 from-background/90 to-transparent group-hover:opacity-100 opacity-0 transition-opacity duration-300 rounded-b-sg">
                          <p className="text-sm truncate">
                            {
                              gamelistdata.titles.find(
                                (item: { lang: string }) =>
                                  item.lang === gamelistdata.olang
                              )?.title
                            }
                          </p>
                          <div className="italic opacity-70 text-xs">
                            {gamelistdata.titles.find(
                              (item: { lang: string }) =>
                                item.lang === "zh-Hans"
                            )?.title ||
                              gamelistdata.titles.find(
                                (item: { official: string }) =>
                                  item.official === "t"
                              )?.title ||
                              gamelistdata.titles.find(
                                (item: { lang: string }) => item.lang === "jp"
                              )?.title}
                          </div>
                        </div>
                      )}
                    </div>
                    <div
                      className={cn(
                        "m-1 transition-all duration-300",
                        layout === "row" && " flex flex-col",
                        layout === "block" && "flex flex-col",
                        layout === "grid" && "hidden"
                      )}
                    >
                      <p className="font-medium text-sm">
                        {
                          gamelistdata.titles.find(
                            (item: { lang: string }) =>
                              item.lang === gamelistdata.olang
                          )?.title
                        }
                      </p>
                      <div className="italic opacity-70 text-xs">
                        {gamelistdata.titles.find(
                          (item: { lang: string }) => item.lang === "zh-Hans"
                        )?.title ||
                          gamelistdata.titles.find(
                            (item: { official: string }) =>
                              item.official === "t"
                          )?.title ||
                          gamelistdata.titles.find(
                            (item: { lang: string }) => item.lang === "jp"
                          )?.title}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </MontionWhileHover>
            </Link>
          ))
        )}
        <button
          onClick={() => fetchNextPage()}
          disabled={!hasNextPage || isFetchingNextPage}
        >
          {isFetchingNextPage
            ? "喵呜~数据正在蹦蹦跳跳地跑过来呢，请主人稍等喵～(ฅ’ω’ฅ)"
            : hasNextPage
            ? "Load More"
            : "喵呜~数据正在蹦蹦跳跳地跑过来呢，请主人稍等喵～(ฅ’ω’ฅ)"}
        </button>
      </div>
    </>
  );
}
