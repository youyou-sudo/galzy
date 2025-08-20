import React from "react";
import { tagshData } from "../(action)/tags";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export async function TagsCard({ id }: { id: string }) {
  const tags = await tagshData(id);
  return (
    <div className="flex flex-wrap gap-2">
      {tags?.tag.map((item) => (
        <Badge variant="secondary" key={item.tag_data?.id}>
          <Link href={`/tags/${item.tag_data?.id}`}>
            {item.tag_data?.zht_name || item.tag_data?.name}
          </Link>
        </Badge>
      ))}
    </div>
  );
}
