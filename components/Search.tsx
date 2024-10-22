"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { Input } from "@nextui-org/react";

import { SearchIcon } from "@/components/icons";

export default function Search() {
  const searchParams = useSearchParams();
  const { replace } = useRouter();

  const handleSearch = (term: string) => {
    const params = new URLSearchParams(searchParams);
    const pages = searchParams.get("pages");
    if (pages) {
      params.delete("pages", pages);
    }
    if (term) {
      params.set("query", term);
    } else {
      params.delete("query");
    }
    replace(`/search?${params.toString()}`);
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleSearch((event.target as HTMLInputElement).value);
    }
  };

  return (
    <Input
      isClearable
      className="max-w-2xl mx-auto my-auto"
      defaultValue={searchParams.get("query") || ""}
      startContent={
        <SearchIcon className="text-base text-default-400 pointer-events-none flex-shrink-0" />
      }
      labelPlacement="outside"
      placeholder="会社、游戏名、作者、单词……  Press enter"
      onKeyPress={handleKeyPress}
    />
  );
}
