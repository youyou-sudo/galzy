import React from "react";

import { getVnDetails } from "@/lib/repositories/vnRepository";
import { ContentCard } from "@/components/vnid-page/ContentCard";
import { TapCatd } from "@/components/vnid-page/tapCard";

export const revalidate = 60;

export default async function idPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  const data = await getVnDetails(id);
  return (
    <div className="space-y-3">
      <ContentCard data={data} />
      <TapCatd id={id} />
    </div>
  );
}
