"use client";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
// import { useRouter } from "@bprogress/next/app";
import { useTransitionRouter } from "next-view-transitions";

import { Search } from "lucide-react";

export default function SearchInput(pops: { className?: string }) {
  const searchParams = useSearchParams();
  const router = useTransitionRouter();

  return (
    <div className="*:not-first:mt-2">
      <div className="flex rounded-md shadow-xs">
        <Input
          {...pops}
          className="-me-px flex-1 rounded-e-none shadow-none focus-visible:z-10"
          placeholder="游戏名、作者、单词……  Press enter"
          type="search"
          name="query"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const query = e.currentTarget.value;
              router.push(`/search?query=${encodeURIComponent(query)}`);
            }
          }}
          defaultValue={searchParams.get("query") || ""}
        />

        <button
          onClick={(e) => {
            const query = e.currentTarget.value;
            router.push(`/search?query=${encodeURIComponent(query)}`);
          }}
          className="border-input bg-background text-foreground hover:bg-accent hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 inline-flex items-center rounded-e-md border px-3 text-sm font-medium transition-[color,box-shadow] outline-none focus:z-10 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Search size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
