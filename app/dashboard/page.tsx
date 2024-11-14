import React from "react";
import { stringify, parse } from "flatted";
import { Card } from "@/components/ui/card";

import { datadbup } from "@/lib/vndbdata";
import DataTable from "./(components)/dataTable";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const row = await datadbup();
  const rows = parse(stringify(row));
  return (
    <div>
      <Card className="w-full">
        <DataTable rows={rows} />
      </Card>
    </div>
  );
}
