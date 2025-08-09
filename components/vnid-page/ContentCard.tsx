"use client";

import React from "react";
import { BBCodeRenderer } from "@/components/bbcode";
import { getImageUrl } from "@/lib/ImageUrl";
import Image from "next/image";

import { getVnDetails } from "@/lib/repositories/vnRepository";
import Errors from "@/components/error";

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

  const getTitle = () => {
    const zhTitle = data.titles.find((item) => item.lang === "zh-Hans")?.title;
    const officialTitle = data.titles.find(
      (item) => item.official === true
    )?.title;
    return zhTitle || officialTitle;
  };

  return (
    <div className="mt-10 flex flex-col md:flex-row">
      <div className="flex flex-row items-center">
        <div className="mr-4 mb-4 w-[250px] border rounded-lg bg-muted space-y-2 flex items-center">
          <Image
            width={data.images?.width}
            height={data.images?.height}
            className="w-full h-auto rounded-lg"
            src={getImageUrl(data.images)}
            alt="游戏图片"
          />
        </div>

        {/* 小屏标题块 */}
        <div className="md:hidden mb-4 flex flex-col justify-end max-w-3/5">
          <div className="text-sm/7 ">
            {data.titles.find((item) => item.lang === data.olang)?.title !==
              getTitle() &&
              data.titles.find((item) => item.lang === data.olang)?.title}
          </div>
          <h1 className="text-xl select-all font-bold sm:text-2xl">
            {getTitle()}
          </h1>
          {data.alias.length > 0 && (
            <div className="opacity-70 text-xs">
              {data.alias
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
                .filter((s) => s !== getTitle())
                .join(", ")}
            </div>
          )}
        </div>
      </div>

      {/* 右侧文字内容 */}
      <div className="flex flex-col flex-1 min-w-2/3">
        <div className="hidden md:block">
          <div className="text-sm/7">
            {data.titles.find((item) => item.lang === data.olang)?.title !==
              getTitle() &&
              data.titles.find((item) => item.lang === data.olang)?.title}
          </div>
          <h1 className="text-lg select-all font-bold sm:text-2xl md:text-4xl">
            {getTitle()}
          </h1>

          {data.alias.length > 0 && (
            <div className="text-sm/7 ">
              {data.alias
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
                .filter((s) => s !== getTitle())
                .join(", ")}
            </div>
          )}
        </div>

        <div
          id="bbccode"
          className="line-clamp-3 text-sm/7 text-muted-foreground mt-2"
        >
          <BBCodeRenderer text={data.description || ""} />
        </div>
      </div>
    </div>
  );
};
