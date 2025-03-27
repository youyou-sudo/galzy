import React from "react";
import type { Metadata } from "next";
import { vndbmget, type VndbdImages } from "@/lib/vndbdata";
import { ContentCard } from "./(components)/ContentCard";
import Datalistview from "./(components)/Datalistview";
import { env } from "next-runtime-env";
import {
  HydrationBoundary,
  dehydrate,
  QueryClient,
} from "@tanstack/react-query";
import {
  dlinkQuery,
  fileQuery,
  type FormattedNode,
} from "./(action)/alistFIleGet";
import Errors from "@/components/error";
import type { duptimes, vndbdatas } from "@prisma/client";
import { vndbdatagsdata } from "./(action)/vndbGet";

export async function generateMetadata({
  params,
}: {
  params: { vnid: string };
}): Promise<Metadata> {
  // read route params
  const { vnid } = await params;

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["vnidPageData", vnid],
    queryFn: () => vndbmget({ vnid }),
  });
  const contentdatas = queryClient.getQueryData<VndbdImages>([
    "vnidPageData",
    vnid,
  ]);

  if (!contentdatas) {
    return {
      title: "VNDB - Galgame",
    };
  }

  // 提取标题
  const titles = [
    ...contentdatas.titles
      .filter((item) => item.lang === "zh-Hans" || item.official === "t")
      .map((item) => item.title),
    ...contentdatas.releases
      .filter((item) => item.lang === "zh-Hans")
      .map((item) => item.title),
  ];
  // 过滤掉 null 后去重
  const allTitles: string[] = Array.from(
    new Set(titles.filter((title): title is string => title !== null))
  );

  const title =
    contentdatas.titles.find((item) => item.lang === "zh-Hans")?.title ||
    contentdatas.titles.find((item) => item.official === "t")?.title;
  return {
    title: title,
    description: contentdatas.description,
    keywords: allTitles,
    openGraph: {
      title: title,
      images: [
        contentdatas!.image
          ? `${env("NEXT_PUBLIC_VNDBIMG_URI")}/${contentdatas!.image.substring(
              0,
              2
            )}/${contentdatas!.image.slice(-2)}/${contentdatas!.image.slice(2)}.jpg`
          : "/lazye.webp",
      ],
      description: contentdatas.description,
    },
  };
}

async function vndbidpage({ params }: { params: { vnid: string } }) {
  try {
    const { vnid } = await params;

    const queryClient = new QueryClient();
    await queryClient.prefetchQuery<vndbdatas>({
      queryKey: ["vnidPageData", vnid],
      queryFn: () => vndbmget({ vnid }),
    });
    await queryClient.prefetchQuery<vndbdatas>({
      queryKey: ["tags", vnid],
      queryFn: () => vndbdatagsdata(vnid),
    });
    const contentdatas = queryClient.getQueryData<VndbdImages>([
      "vnidPageData",
      vnid,
    ]);

    await queryClient.prefetchQuery({
      queryKey: ["fileListData", vnid],
      queryFn: () => fileQuery(vnid),
    });

    await queryClient.prefetchQuery({
      queryKey: ["dlinkData"],
      queryFn: () => dlinkQuery(),
    });

    const filedata = queryClient.getQueryData<FormattedNode[]>([
      "fileListData",
      vnid,
    ]);
    const dlink = queryClient.getQueryData<duptimes>(["dlinkData"]);

    if (!contentdatas) {
      return (
        <div className="max-w-3xl mx-auto my-auto">
          <Errors
            code="404"
            errormessage={`找不到 ${vnid} 的数据喵～是不是藏起来了？🐱💭✨`}
          />
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-5xl">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <ContentCard data={contentdatas} />
          <Datalistview filedatas={filedata} dlink={dlink!} vid={vnid} />
        </HydrationBoundary>
      </div>
    );
  } catch (error) {
    return (
      <div className="max-w-3xl mx-auto my-auto">
        <Errors code="404" errormessage={error} />
      </div>
    );
  }
}
export default vndbidpage;
