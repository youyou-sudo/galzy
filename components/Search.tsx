"use client";
import { useSearchParams } from "next/navigation";
import { Input } from "@nextui-org/react";
import Form from "next/form";

export default function Search() {
  const searchParams = useSearchParams();

  return (
    <Form action="/search">
      <Input
        type="search"
        name="query"
        className="w-96"
        defaultValue={searchParams.get("query") || ""}
        labelPlacement="outside"
        placeholder="会社、游戏名、作者、单词……  Press enter"
      />
    </Form>
  );
}
