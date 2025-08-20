import React from "react";
import { meiliSearchData } from "../(action)/tags";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export async function TagsCard({ id }: { id: string }) {
  const tags = await meiliSearchData(id);
  return (
    <div className="flex flex-wrap gap-2">
      {tags?.tag.map((item) => (
        <Badge variant="secondary" key={item.tag_zh?.id || item.tag_data?.id}>
          <Link href={`/tags/${item.tag_zh?.id || item.tag_data?.id}`}>
            {item.tag_zh?.name || item.tag_data?.name}
          </Link>
        </Badge>
      ))}
    </div>
  );
}
