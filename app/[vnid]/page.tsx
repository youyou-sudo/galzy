import React from "react";
import { vndbmget } from "@/lib/vndbdata";
import { ContentCard } from "@/app/[vnid]/(components)/ContentCard";
import { stringify, parse } from "flatted";
import Datalistview from "@/app/[vnid]/(components)/Datalistview";
import Errors from "@/components/error";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  openGraph: {
    title: "VNDB DATA?",
    description: "VNDB DATA",
  },
};

async function vndbidpage({
  params,
}: {
  params: { vnid: string };
  searchParams: any;
}) {
  const { vnid } = await params;
  metadata.openGraph ||= {};
  try {
    const datas = await vndbmget({ vnid });
    const contentdatas = await parse(stringify(datas));

    // 提取标题
    const titles = [
      ...contentdatas.titles
        .filter((item) => item.lang === "zh-Hans" || item.official === "t")
        .map((item) => item.title),
      ...contentdatas.releases
        .filter((item) => item.lang === "zh-Hans" || item.official === "t")
        .map((item) => item.title),
    ];

    // 去重并获取标题
    const allTitles = Array.from(new Set(titles));
    const title =
      contentdatas.titles.find((item) => item.lang === "zh-Hans")?.title ||
      contentdatas.titles.find((item) => item.official === "t")?.title ||
      "默认标题"; // 设置默认标题以防止 undefined

    // 更新 metadata
    metadata.openGraph.title = title;
    metadata.title = title;
    metadata.description = title;
    metadata.openGraph.description = `${title} 下载`;
    metadata.keywords = allTitles;
    metadata.openGraph.images = contentdatas.image
      ? `${process.env.NEXT_PUBLIC_VNDBIMG_URI}/${contentdatas.image.substring(
          0,
          2
        )}/${contentdatas.image.slice(-2)}/${contentdatas.image.slice(2)}.jpg`
      : "https://dummyimage.com/679x481/9e9e9e/fff";

    return (
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="hover:underline">
          ⬅返回
        </Link>
        <ContentCard data={contentdatas} />
        <Datalistview filedatas={datas.filesdata} />
      </div>
    );
  } catch (error) {
    return (
      <div className="max-w-3xl mx-auto my-auto">
        <Errors code="404" />
      </div>
    );
  }
}
export default vndbidpage;
