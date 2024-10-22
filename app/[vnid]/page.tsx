import React from "react";
import { vndbmget, vndbidExists } from "@/lib/vndbdata";
import { ContentCard } from "@/app/[vnid]/(components)/ContentCard";
import { stringify, parse } from "flatted";
import Datalistview from "@/app/[vnid]/(components)/Datalistview";
import Errors from "@/components/error";
import { alistListGet } from "@/app/[vnid]/(action)/alistGet";
import type { Metadata } from "next";
import { Link } from "@nextui-org/link";

export const metadata: Metadata = {
  openGraph: {
    title: "VNDB DATA?",
    description: "VNDB DATA",
  },
};

async function vndbidpage({ params }) {
  const { vnid } = await params;
  try {
    const datas = await vndbmget({ vnid });
    const contentdatas = await parse(stringify(datas));
    const l_iddata = extractLinkedIds(contentdatas.releases);
    l_iddata.push(vnid);
    const filedatas = await vndbidExists(l_iddata);
    const listtest: any = await alistListGet(filedatas);
    // 确保 metadata.openGraph 存在
    metadata.openGraph ||= {}; // 使用逻辑或赋值来初始化

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
        <Link href="/" underline="hover">
          ⬅返回
        </Link>
        <ContentCard data={contentdatas} />
        <Datalistview filedatas={filedatas} dlink={listtest.dlink} />
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

function extractLinkedIds(releases) {
  return releases
    .flatMap((release) => [
      release.l_steam,
      release.l_egs,
      release.l_dlsite,
      release.l_digiket,
    ])
    .filter((value) => value !== undefined && value !== "" && value !== null);
}

export default vndbidpage;
