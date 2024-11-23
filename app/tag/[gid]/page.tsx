import React from "react";
import type { Metadata } from "next";
import { tagsvndbInfo } from "./(action)/Tagvndb";
import TagsContentCard from "./(components)/TagsContentCard";
import Ttip from "./(components)/Ttip";
import { Gamelsit } from "@/app/(components)/gamelist";
import { PaginationWithLinks } from "@/components/pagination-with-links";

export const metadata: Metadata = {
  openGraph: {
    title: "VNDB DATA?",
    description: "VNDB DATA",
  },
};

export const dynamic = "force-dynamic";

export default async function page({
  searchParams,
  params,
}: {
  searchParams: any;
  params: { gid: string };
}) {
  const { gid } = await params;
  const id = await gid;
  const { pages } = await searchParams;
  const pagess = parseInt(pages) || 1;
  const data = await tagsvndbInfo({ id, pagess });
  metadata.openGraph ||= {};
  metadata.openGraph.title = data.giddata.name;
  metadata.title = data.giddata.name;
  metadata.description = data.giddata.description;
  metadata.openGraph.description = data.giddata.description;
  metadata.keywords = data.giddata.alias;
  return (
    <div className="max-w-3xl mx-auto my-auto">
      <TagsContentCard data={data} />
      <Ttip gid={data.giddata.gid}></Ttip>
      <Gamelsit datas={data.giddata.vndbdatas} />
      <PaginationWithLinks page={data.page} totalCount={data.totalpageCount} />
    </div>
  );
}
