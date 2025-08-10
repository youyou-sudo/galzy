import { GameCard } from "@/components/game-card";
import React, { Suspense } from "react";

export function Pages() {
  return <div>pages</div>;
}

const DfPage = () => {
  return (
    <div className="space-y-3">
      <Suspense fallback={<GameCard.IdGameCardSkeleton />}>
        <Pages />
      </Suspense>
    </div>
  );
};

export default DfPage;
