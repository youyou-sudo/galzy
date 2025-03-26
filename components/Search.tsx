"use client";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useRouter } from "@bprogress/next/app";

export default function SearchInput() {
  const searchParams = useSearchParams();
  const router = useRouter();

  return (
    <>
      <Input
        type="search"
        name="query"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const query = e.currentTarget.value;
            router.push(`/search?query=${encodeURIComponent(query)}`);
          }
        }}
        defaultValue={searchParams.get("query") || ""}
        className="bg-muted border-transparent shadow-none peer ps-9"
        placeholder="游戏名、作者、单词……  Press enter"
      />
      <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
        <Search size={16} aria-hidden="true" />
      </div>
    </>
  );
}
