import { getVnDetails } from "@/lib/repositories/vnRepository";
import { Modal } from "../(.)login/modal";
import { ContentCard } from "@/components/vnid-page/ContentCard";
import { TapCatd } from "@/app/(app)/[id]/(components)";

export default async function page({ params }: { params: { id: string } }) {
  const { id } = await params;
  const data = await getVnDetails(id);
  return (
    <Modal>
      <div className="space-y-3">
        <ContentCard data={data} />
        <TapCatd id={id} />
      </div>
    </Modal>
  );
}
