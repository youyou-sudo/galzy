"use client";

import React from "react";
import { BBCodeRenderer } from "@/components/bbcode";
import { getImageUrl, imageAcc } from "@/lib/ImageUrl";
import Image from "next/image";

import { getVnDetails } from "@/lib/repositories/vnRepository";
import Errors from "@/components/error";

type VnData = Awaited<ReturnType<typeof getVnDetails>>;
type Props = {
  data: VnData;
};
export const ContentCard = ({ data }: Props) => {
  console.log(data);

  if (!data) {
    return (
      <div>
        <Errors code="400" />
      </div>
    );
  }

  const getTitles = () => {
    const zhHansTitle =
      data.other_datas?.title?.find(
        (it: { lang: string }) => it.lang === "zh-Hans"
      )?.title ?? null;

    const olangTitle =
      data.vn_datas?.titles.find(
        (it: { lang: string }) => it.lang === data.vn_datas?.olang
      )?.title ?? null;

    return {
      zhHans: zhHansTitle,
      olang: olangTitle,
    };
  };

  const imageFilter = () => {
    const images =
      data.other && data.other_datas?.media.some((item) => item.cover === true)
        ? data.other_datas.media.find((item) => item.cover === true)
            ?.media_datas
        : data.vn_datas?.images;
    return images;
  };

  const aliasFilter = () => {
    const alias = data.other_datas?.alias
      ? data.other_datas.alias
      : data.vn_datas?.alias;
    return alias;
  };
  const filteredImage = imageFilter();
  const titlesData = getTitles();
  const aliasData = aliasFilter();
  const imageUrl =
    filteredImage &&
    typeof filteredImage === "object" &&
    "hash" in filteredImage
      ? imageAcc(filteredImage.name)
      : getImageUrl({
          imageId: filteredImage!.id,
          width: filteredImage!.width,
          height: filteredImage!.height,
        });
  console.log(imageUrl);
  return (
    <div className="mt-10 flex flex-col md:flex-row">
      <div className="flex flex-row items-center">
        <div className="mr-4 mb-4 w-[250px] border rounded-lg bg-muted space-y-2 flex items-center">
          <Image
            width={filteredImage?.width}
            height={filteredImage?.height}
            className="w-full h-auto rounded-lg"
            src={imageUrl}
            alt="游戏图片"
          />
        </div>

        {/* 小屏标题块 */}
        <div className="md:hidden mb-4 flex flex-col justify-end max-w-3/5">
          {titlesData.olang && (
            <div className="text-sm/7 ">{titlesData.olang}</div>
          )}
          <h1 className="text-xl select-all font-bold sm:text-2xl">
            {titlesData.zhHans}
          </h1>
          {aliasData && (
            <div className="opacity-70 text-xs">
              {aliasData
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
                .filter((s) => s !== titlesData.zhHans)
                .join(", ")}
            </div>
          )}
        </div>
      </div>

      {/* 右侧文字内容 */}
      <div className="flex flex-col flex-1 min-w-2/3">
        <div className="hidden md:block">
          {titlesData.olang && (
            <div className="text-xl ">{titlesData.olang}</div>
          )}
          <h1 className="text-lg select-all font-bold sm:text-2xl md:text-4xl">
            {titlesData.zhHans}
          </h1>

          {aliasData && (
            <div className="text-sm/7 ">
              {aliasData
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
                .filter((s) => s !== titlesData.zhHans)
                .join(", ")}
            </div>
          )}
        </div>

        <div
          id="bbccode"
          className="line-clamp-3 text-sm/7 text-muted-foreground mt-2"
        >
          {(data.other_datas?.description || data.vn_datas?.description) && (
            <BBCodeRenderer
              text={
                data.other_datas?.description ||
                data.vn_datas?.description ||
                ""
              }
            />
          )}
        </div>
      </div>
    </div>
  );
};
