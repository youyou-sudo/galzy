"use client";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { useRouter } from "@bprogress/next/app";

export default function SearchInput() {
  const searchParams = useSearchParams();
  const router = useRouter();

  return (
    <>
      {/* <Input
        type="search"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const query = e.currentTarget.value;
            router.push(`/search?query=${encodeURIComponent(query)}`);
          }
        }}
        placeholder="游戏名、作者、单词……  Press enter"
        className="h-9 pl-9 pr-4 rounded-full bg-muted/40 border-muted hover:bg-background hover:border-input focus:bg-background focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all duration-200"
      /> */}
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
        placeholder="游戏名、作者、单词……  Press enter"
      />
      {/* <Search className="absolute left-3 h-4 w-4 text-muted-foreground" /> */}
      {/* <Button
        variant="ghost"
        size="icon"
        className="md:hidden rounded-full hover:bg-muted/60"
      >
        <Search className="h-4 w-4" />
        <span className="sr-only">Search</span>
      </Button> */}
      {/* <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
        <Search size={16} aria-hidden="true" />
      </div> */}
    </>
  );
}
