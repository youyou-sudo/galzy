"use client";

import { env } from "next-runtime-env";
import { ImagesTable } from "@/lib/kysely";

/**
 * 根据图片数据规格生成图片 URL
 * @param image - 要处理的图片标识符字符串
 * @param imagesData - 来自 Prisma images 表的图片元数据
 * @returns 图片的 URL 路径字符串
 * - 如果图片尺寸超过 256x400 则返回缩略图版本 (.t)
 * - 如果尺寸较小则返回原始版本
 * @example
 * ```typescript
 * getImageUrl("cv3838", {width: "300", height: "500"})
 * // 返回 `string` : "[NEXT_PUBLIC_VNDBIMG_URI]/cv.t/38/3838.jpg"
 * getImageUrl("cv3839", {width: "256", height: "400"})
 * // 返回 `string` : "[NEXT_PUBLIC_VNDBIMG_URI]/cv/39/3839.jpg"
 * ```
 */
export const getImageUrl = (imagesData: ImagesTable | null): string => {
  if (!imagesData) {
    return "";
  }
  return imagesData && imagesData.width > 256 && imagesData.height > 400
    ? `${env("NEXT_PUBLIC_VNDBIMG_URI")}/${imagesData.id.substring(
        0,
        2
      )}.t/${imagesData.id.slice(-2)}/${imagesData.id.slice(2)}.jpg`
    : `${env("NEXT_PUBLIC_VNDBIMG_URI")}/${imagesData.id.substring(
        0,
        2
      )}/${imagesData.id.slice(-2)}/${imagesData.id.slice(2)}.jpg`;
};
