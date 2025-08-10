import React, { Suspense } from "react";

import { getVnDetails } from "@/lib/repositories/vnRepository";
import { ContentCard } from "@/components/vnid-page/ContentCard";
import { TapCatd } from "@/components/vnid-page/tapCard";
import { GameCard } from "@/components/game-card";

export async function IdPage({ id }: { id: string }) {
  const data = await getVnDetails(id);
  return (
    <>
      <ContentCard data={data} />
      <TapCatd id={id} />
    </>
  );
}

const DfPage = async ({ params }: { params: { id: string } }) => {
  const { id } = await params;
  return (
    <div className="space-y-3">
      <Suspense fallback={<GameCard.IdGameCardSkeleton />}>
        <IdPage id={id} />
      </Suspense>
    </div>
  );
};

export default DfPage;
