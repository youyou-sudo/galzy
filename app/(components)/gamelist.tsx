"use client";
import Image from "next/image";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import MontionWhileHover from "@/components/motion/whileHover";
import { cn } from "@/lib/utils";

import { getImageUrl } from "@/lib/ImageUrl";
import type { VndbdImages } from "@/lib/vndbdata";

export function Gamelsit({ datas }: { datas: VndbdImages[] }) {
  return (
    <>
      {datas.map((gamelistdata) => (
        <Link href={`/${gamelistdata.vnid}`} key={gamelistdata.vnid}>
          <MontionWhileHover>
            <Card
              className={cn(
                "h-full overflow-hidden transition-all duration-300 flex mt-2 w-full",
                "border-2 hover:border-primary/50 hover:shadow-lg"
              )}
            >
              <CardContent className="flex p-3 flex-nowrap flex-row">
                <div className="relative shrink-0">
                  <Image
                    unoptimized
                    width={70}
                    height={140}
                    className="object-cover rounded-md h-[100px] w-[70px]"
                    sizes="(max-width: 1200px) 100vw, (max-width: 768px) 50vw, 33vw"
                    src={getImageUrl(
                      gamelistdata.image,
                      gamelistdata.imagesData
                    )}
                    alt="图片"
                  />
                </div>
                <div className="ml-3 truncate">
                  <p className="font-bold truncate">
                    {
                      gamelistdata.titles.find(
                        (item: { lang: string }) =>
                          item.lang === gamelistdata.olang
                      )?.title
                    }
                  </p>
                  <div className="italic opacity-70 text-sm truncate">
                    {gamelistdata.titles.find(
                      (item: { lang: string }) => item.lang === "zh-Hans"
                    )?.title ||
                      gamelistdata.titles.find(
                        (item: { official: string }) => item.official === "t"
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
      ))}
    </>
  );
}
