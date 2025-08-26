import StrategyList from "@/components/dashboard/dataManagement/strategy/strategyList";
import { getVnDetails } from "@/lib/repositories/vnRepository";
import { Metadata } from "next/types";
import React from "react";
import { aliasFilter, getTitles } from "../(lib)/contentDataac";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await getVnDetails(id);
  const [titlesData, aliasData] = await Promise.all([
    getTitles({ data }),
    aliasFilter({ data }),
  ]);
  return {
    title: "攻略",
    description: `${
      titlesData.zhHans || titlesData.olang || "Gamgame"
    } 游戏别名：${aliasData || "无"} 的攻略文章列表，`,
  };
}

export default async function page({ params }: { params: { id: string } }) {
  const { id } = await params;
  return <StrategyList id={id} />;
}
