import { stringify, parse } from "flatted";
import MeiliConfig from "./(components)/MeiliConfig";
import prisma from "@/lib/prisma";
import IndexCard from "./(components)/IndexCard";
import { getIndexList } from "./(action)/indexGet";

export default async function VndbDatasPage() {
  const meilisearchconfig = await prisma.meilisearchdatas.findFirst({});
  const meilisearchconfigstring = parse(stringify(meilisearchconfig));
  const meiliindexviw = await getIndexList();

  return (
    <div className="grid gap-y-4">
      <MeiliConfig meilisearchconfig={meilisearchconfigstring} />
      <IndexCard meiliindexviwss={meiliindexviw} />
    </div>
  );
}
