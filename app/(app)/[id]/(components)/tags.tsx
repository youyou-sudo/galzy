import { Card, CardContent } from "@/components/ui/card";
import React from "react";
import { meiliSearchData } from "../(action)/tags";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import Spoiler from "./Spoiler";

export async function TagsCard({ id }: { id: string }) {
  const tags = await meiliSearchData(id);
  return (
    <Card>
      <CardContent className="flex w-full flex-wrap gap-2">
        <h2>标签</h2>
        <Spoiler>
          {tags?.tag.map((item) => (
            <Badge
              variant="secondary"
              key={item.tag_zh?.id || item.tag_data?.id}
            >
              <Link href={`/tags/${item.tag_zh?.id || item.tag_data?.id}`}>
                {item.tag_zh?.name || item.tag_data?.name}
              </Link>
            </Badge>
          ))}
        </Spoiler>

        
      </CardContent>
    </Card>
  );
}
