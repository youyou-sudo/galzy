import React from "react";
import EditComponent from "@/components/dashboard/dataManagement/edit/EditComponent";
import { vidassociationGet } from "@/lib/dashboard/dataManagement/dataGet";

export default async function page({ params }: { params: { id: string } }) {
  const { id } = await params;
  if (!id) {
    return <div>Invalid ID</div>;
  }
  const data = await vidassociationGet(id);
  return (
    <div>
      <EditComponent data={data} />
    </div>
  );
}
