import { UmamiCard, MeiliSearch } from "@/components/dashboard/config";

export default function page() {
  return (
    <div className="space-y-3">
        <UmamiCard />
        <MeiliSearch />
    </div>
  );
}
