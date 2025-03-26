"use client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";

import React from "react";

export default function Ttip({ gid }: { gid: string }) {
  return (
    <div className="flex justify-center">
      <TooltipProvider>
        <Tooltip delayDuration={10}>
          <TooltipTrigger className="italic mt-2">相关 Games</TooltipTrigger>
          <TooltipContent>
            <div className="text-tiny">
              这里只显示已收录游戏喵，更详细列表，请到{" "}
              <Link
                className="text-tiny text-cyan-500"
                target="_blank"
                href={`https://vndb.org/${gid}`}
              >
                vndb.org
              </Link>{" "}
              查看喵～❤
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
