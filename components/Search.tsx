"use client";
import { useSearchParams } from "next/navigation";
import { Input } from "@nextui-org/react";
import Form from "next/form";

export default function Search() {
  const searchParams = useSearchParams();

  return (
    <Form action="/search" className="w-full max-w-xl">
      <Input
        type="search"
        name="query"
        className="flex w-full"
        defaultValue={searchParams.get("query") || ""}
        labelPlacement="outside"
        placeholder="游戏名、作者、单词……  Press enter"
      />
    </Form>
  );
}
