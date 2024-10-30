"use client";
import { Link, Tooltip } from "@nextui-org/react";
import React from "react";

export default function Ttip({ gid }: { gid?: string }) {
  return (
    <div>
      <Tooltip
        content={
          <div className="text-tiny">
            只显示本站已收录游戏，如果要查看更详细列表，请到{" "}
            <Link
              className="text-tiny text-cyan-500"
              target="_blank"
              href={`https://vndb.org/${gid}`}
            >
              vndb.org
            </Link>{" "}
            查看喵～❤
          </div>
        }
      >
        <div className="text-center italic mt-3">相关 Games</div>
      </Tooltip>
    </div>
  );
}
