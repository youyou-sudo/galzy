import React from "react";
import { BBCodeRenderer } from "@/components/bbcode";
import Image from "next/image";

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/animate-ui/radix/accordion";
import { getVnDetails } from "@/lib/repositories/vnRepository";
import Errors from "@/components/error";
import { TagsCard } from "@/app/(app)/[id]/(components)/tags";
import {
  aliasFilter,
  getCoverImageUrl,
  getTitles,
  imageFilter,
} from "../../(lib)/contentDataac";
import { Card, CardContent } from "@/components/ui/card";

type VnData = Awaited<ReturnType<typeof getVnDetails>>;
type Props = {
  data: VnData;
};
export const ContentCard = ({ data }: Props) => {
  if (!data) {
    return (
      <div>
        <Errors code="400" />
      </div>
    );
  }
  const filteredImage = imageFilter({ data });
  const titlesData = getTitles({ data });
  const aliasData = aliasFilter({ data });
  const imageUrl = getCoverImageUrl({ data });

  return (
    <Card className="overflow-hidden break-words shadow-lg pb-0">
      <CardContent>
        {/* Cover and basic info section */}
        <div className="sm:float-right text-center sm:text-right sm:ml-4 pb-4 mb-1 relative">
          <div className="relative inline-block">
            <div
              className={`${
                filteredImage!.height < filteredImage!.width
                  ? "min-w-[290px]"
                  : "min-w-[220px]"
              } shadow-lg relative overflow-hidden text-left`}
            >
              <Image
                width={filteredImage?.width}
                height={filteredImage?.height}
                className="w-full h-full  transition-transform relative z-10 rounded"
                src={imageUrl || "/placeholder.svg"}
                alt="游戏图片"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </div>

        {/* Main content section */}
        <div className="overflow-hidden break-words">
          {/* Title section */}
          {titlesData.olang && (
            <div className="text-sm leading-[1.2]">{titlesData.olang}</div>
          )}

          <div className="font-bold text-2xl leading-[1.2] mt-2">
            {titlesData.zhHans || titlesData.olang}
          </div>

          {/* Aliases */}
          {aliasData && (
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-[1.2]">
              别名:{" "}
              {aliasData
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
                .filter((s) => s !== titlesData.zhHans)
                .join(", ")}
            </div>
          )}

          {/* Description */}
          {(data.other_datas?.description || data.vn_datas?.description) && (
            <div className="mt-4">
              <div className="text-xs text-gray-500 uppercase mb-1">
                游戏简介
              </div>
              <div className="text-sm line-clamp-6  leading-relaxed text-gray-800 dark:text-gray-200">
                <BBCodeRenderer
                  text={
                    data.other_datas?.description ||
                    data.vn_datas?.description ||
                    ""
                  }
                />
              </div>
            </div>
          )}

          {/* Tags section */}
          {data.vid && (
            <div className="mt-4 mb-5">
              <Accordion type="single" collapsible className="w-full ">
                <AccordionItem
                  value="tags"
                  className="px-3 border-1 rounded-lg"
                >
                  <AccordionTrigger className="text-sm opacity-70 hover:opacity-100 py-3">
                    游戏标签（包含剧透）
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    <TagsCard id={data.vid} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
