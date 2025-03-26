"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { meilliTasksList } from "@/lib/meilisearch/indexGet";
import { useQuery } from "@tanstack/react-query";

export default function TaskeListCard() {
  const { data: taskslist } = useQuery({
    queryKey: ["meiliTasksList"],
    queryFn: () => meilliTasksList(),
    refetchInterval: 3000,
  });
  return (
    <div className="w-full border rounded-md overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">uid</TableHead>
            <TableHead>indexUid</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>status</TableHead>
            <TableHead>enqueuedAt（用时）</TableHead>
            <TableHead>startedAt（创建时间）</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {taskslist?.data?.results?.map(
            (item: {
              uid: string;
              indexUid: string;
              type: string;
              status: string;
              startedAt: string;
              duration: string;
            }) => (
              <TableRow key={item.uid} className="odd:bg-muted/50">
                <TableCell className="pl-4">{item.uid}</TableCell>
                <TableCell className="font-medium">{item.indexUid}</TableCell>
                <TableCell>{item.type}</TableCell>
                <TableCell>{item.status}</TableCell>
                <TableCell>
                  {(() => {
                    const durationMs =
                      parseFloat(
                        item.duration?.replace("PT", "").replace("S", "")
                      ) * 1000;
                    return durationMs >= 1000
                      ? (durationMs / 1000).toFixed(1) + " 秒"
                      : durationMs.toFixed(0) + " 毫秒";
                  })()}
                </TableCell>
                <TableCell>
                  {new Date(item.startedAt).toLocaleString()}
                </TableCell>
              </TableRow>
            )
          )}
        </TableBody>
      </Table>
    </div>
  );
}
