"use client";

import { Card, CardBody } from "@nextui-org/react";
import React from "react";
import BBCode from "@bbob/react";
import presetReact from "@bbob/preset-react";

export default function TagsContentCard({ data }: { data: any }) {
  return (
    <>
      <Card>
        <CardBody>
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
          <div
            className="mt-2"
            // dangerouslySetInnerHTML={{ __html: bbccodeHtmlText }}
          >
            <div id="bbccode">
              <BBCode plugins={presetReact()}>
                {data.giddata.description.replace(/\\n/g, "[br]")}
              </BBCode>
            </div>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
