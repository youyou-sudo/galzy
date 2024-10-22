"use client";

import { Card, CardBody, Image, Tooltip } from "@nextui-org/react";
import Platform from "./platform";
import React from "react";
import { motion } from "framer-motion";

export function ContentCard({ data }) {
  const datas = data;
  return (
    <>
      <motion.div
        className="flex flex-col"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card radius="sm" shadow="sm">
          <CardBody className="m-0 p-4 flex-row">
            <div className="w-1/4 shrink-0 mr-3">
              <Image
                isBlurred
                isZoomed
                className="w-full object-cover"
                src={
                  `${process.env.NEXT_PUBLIC_VNDBIMG_URI}/${datas.image.substring(
                    0,
                    2
                  )}/${datas.image.slice(-2)}/${datas.image.slice(2)}.jpg` ||
                  "https://dummyimage.com/679x481/9e9e9e/fff"
                }
                fallbackSrc="https://dummyimage.com/679x481/9e9e9e/fff"
                alt="游戏图片"
              />
            </div>
            <div className="flex flex-col ">
              <div>
                <Tooltip content="zh_title or official title">
                  <h1 className="text-xl select-all font-bold sm:text-2xl md:text-3xl lg:text-4xl">
                    {datas.titles.find((item) => item.lang === "zh-Hans")
                      ?.title ||
                      datas.titles.find((item) => item.official === "t")?.title}
                  </h1>
                </Tooltip>

                <div className="italic opacity-70 select-all">
                  {
                    datas.titles.find((item) => item.lang === datas.olang)
                      ?.title
                  }
                </div>

                <Tooltip content="Alias">
                  {datas.alias.length > 0 && (
                    <div className="italic opacity-70 text-xs">
                      {datas.alias.join(", ")}
                    </div>
                  )}
                </Tooltip>
              </div>
              <Platform datas={datas} />
            </div>

            {/* <ContentSummary summary={contentdatas.summary} /> */}
          </CardBody>
        </Card>
      </motion.div>
    </>
  );
}
