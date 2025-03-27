"use client";
import React from "react";

import { BBCodeRenderer } from "@/components/bbcode";
import { Card, CardContent } from "@/components/ui/card";

import type { TagsvndbInfoType } from "../(action)/Tagvndb";

export default function TagsContentCard({ data }: { data: TagsvndbInfoType }) {
  return (
    <>
      <Card>
        <CardContent>
          <div className="text-center">
            <h1 className="text-xl select-all font-bold sm:text-2xl md:text-3xl lg:text-4xl">
              #{data.giddata.name_zh || data.giddata.name}
            </h1>
            {data.giddata.alias
              .split("\\n") // 将字符串按 '\n' 分割
              .map((line, index) => (
                <div key={index}>{line}</div>
              ))}
          </div>
          <div id="bbccode" className="mt-2">
            <BBCodeRenderer text={data.giddata.description || ""} />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
