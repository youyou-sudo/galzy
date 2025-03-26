import type { Metadata } from "next";
import { tagsvndbInfo, type TagsvndbInfoType } from "./(action)/Tagvndb";
import TagsContentCard from "./(components)/TagsContentCard";
import Ttip from "./(components)/Ttip";
import { Gamelsit } from "@/app/(components)/gamelist";
import { PaginationWithLinks } from "@/components/ui/pagination-with-links";
import { QueryClient } from "@tanstack/react-query";
import Errors from "@/components/error";

export async function generateMetadata({
  searchParams,
  params,
}: {
  searchParams: { pages: string };
  params: { gid: string };
}): Promise<Metadata> {
  const { gid } = await params;
  const { pages } = await searchParams;
  const pagess = parseInt(pages) || 1;
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["TagPagesData", gid, pagess],
    queryFn: () => tagsvndbInfo({ id: gid, pagess }),
  });
  const data = queryClient.getQueryData<any>(["TagPagesData", gid, pagess]);
  return {
    title: `标签 - ${data.giddata.name_zh || data.giddata.name}`,
    description: data.giddata.description,
    keywords: data.giddata.alias,
    openGraph: {
      title: data.giddata.name_zh || data.giddata.name,
      description: data.giddata.description,
    },
  };
}
export default async function page({
  searchParams,
  params,
}: {
  searchParams: { pages: string };
  params: { gid: string };
}) {
  try {
    const { gid } = await params;
    const { pages } = await searchParams;
    const pagess = parseInt(pages) || 1;

    const queryClient = new QueryClient();
    await queryClient.prefetchQuery({
      queryKey: ["tagPageData", gid, pagess],
      queryFn: () => tagsvndbInfo({ id: gid, pagess }),
    });
    const data = queryClient.getQueryData<TagsvndbInfoType>([
      "tagPageData",
      gid,
      pagess,
    ]);
    if (!data) {
      return (
        <div className="max-w-3xl mx-auto my-auto">
          <Errors
            code="404"
            errormessage={`找不到 Tag 的数据喵～是不是藏起来了？🐱💭✨`}
          />
        </div>
      );
    }
    return (
      <div className="max-w-3xl mx-auto my-auto">
        <TagsContentCard data={data} />
        <Ttip gid={data.giddata.gid} />
        <Gamelsit datas={data.giddata.vndbdatas} />
        <div className="mt-4">
          <PaginationWithLinks
            page={data.page}
            pageSize={50}
            totalCount={data.totalpageCount}
          />
        </div>
      </div>
    );
  } catch {
    return (
      <div className="max-w-3xl mx-auto my-auto">
        <Errors
          code="404"
          errormessage={`找不到 Tag 的数据喵～是不是藏起来了？🐱💭✨`}
        />
      </div>
    );
  }
}
