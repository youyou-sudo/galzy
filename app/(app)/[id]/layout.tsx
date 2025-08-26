import React from "react";

import { getVnDetails } from "@/lib/repositories/vnRepository";
import { ContentCard } from "@/app/(app)/[id]/(components)/vnid-page/ContentCard";
import { TapCatd } from "@/app/(app)/[id]/(components)";
import type { Metadata } from "next";
import {
  aliasFilter,
  getCoverImageUrl,
  getTitles,
  imageFilter,
} from "./(lib)/contentDataac";
import { notFound } from "next/navigation";
import { GameViewsTrackEvents } from "@/components/umami/track-events";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await getVnDetails(id);
  if (!data) {
    notFound(); // Next.js 处理方式
  }
  const [titlesData, aliasData, imageUrl, image] = await Promise.all([
    getTitles({ data }),
    aliasFilter({ data }),
    getCoverImageUrl({ data }),
    imageFilter({ data }),
  ]);
  return {
    title: {
      default: titlesData.zhHans || titlesData.olang || "Gamgame",
      template: `${titlesData.zhHans || titlesData.olang || "Gamgame"} - %s`,
    },
    description: `${
      titlesData.zhHans || titlesData.olang || "Gamgame"
    } 的资源下载，游戏别名：${aliasData || "无"}`,
    openGraph: {
      images: [
        {
          url: `/_next/image?url=${imageUrl}&w=${image?.width}&q=75`,
          width: image?.width,
          height: image?.height,
        },
      ],
    },
  };
}

export default async function IdLayout({
  children,
  params,
}: LayoutProps<"/[id]">) {
  const { id } = await params;
  const data = await getVnDetails(id);
  const titlesData = getTitles({ data });
  const idtitle = `[id:${id}]-[${titlesData.olang || titlesData.zhHans}]`;
  return (
    <div className="space-y-3">
      <ContentCard data={data} />
      <TapCatd id={id}>{children}</TapCatd>
      <GameViewsTrackEvents idtitle={idtitle} />
    </div>
  );
}
