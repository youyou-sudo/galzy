import React from "react";

import { getVnDetails } from "@/lib/repositories/vnRepository";
// import { GameCard } from "@/components/vnid-page/info-details";
import { ContentCard } from "@/components/vnid-page/ContentCard";
import { TapCatd } from "@/components/vnid-page/tapCard";

export default async function idPage({ params }: { params: { vnid: string } }) {
  const { vnid } = await params;
  if (vnid.startsWith("v")) {
    const data = await getVnDetails(vnid);
    return (
      <div className="space-y-3">
        {/* <GameCard data={data} /> */}
        <ContentCard data={data} />
        <TapCatd id={vnid} />
      </div>
    );
  }

  return <div>{vnid}</div>;
}
