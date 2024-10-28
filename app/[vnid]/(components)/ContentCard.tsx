"use client";

import {
  Accordion,
  AccordionItem,
  Button,
  Card,
  CardBody,
  CardFooter,
  Divider,
  Image,
  Link,
  Radio,
  RadioGroup,
  Skeleton,
  Switch,
  Tooltip,
} from "@nextui-org/react";
import Platform from "./platform";
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RiFullscreenFill } from "react-icons/ri";
import { vndbdatagsdata } from "../(action)/vndbGet";

export function ContentCard({
  data,
  fullsereenfill,
}: {
  data: any;
  fullsereenfill?: boolean;
}) {
  const datas = data;
  const [tagsdata, setTagsdata] = useState<any>();
  const [isSelected, setIsSelected] = useState(true);
  const [selected, setSelected] = useState("spoilerAlert");

  useEffect(() => {
    const a = async () => {
      const re = await vndbdatagsdata(datas);
      setTagsdata(re);
    };
    a();
  }, [datas]);

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
            {fullsereenfill && (
              <Button
                as={Link}
                href={`/${datas.vnid}`}
                variant="light"
                isIconOnly
                className="flex mr-0 ml-auto"
              >
                <RiFullscreenFill />
              </Button>
            )}
          </CardBody>
          <CardFooter>
            {tagsdata ? (
              <>
                <motion.div
                  className="w-full"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Accordion isCompact defaultExpandedKeys={["1"]}>
                    <AccordionItem key="1" aria-label="TAG" title="TAG">
                      {/* {tagsdata?.tags.map((item, index) => (
                  <div key={index}>{JSON.stringify(item, null, 2)}</div>
                ))} */}
                      <div className="flex">
                        <Switch
                          defaultSelected
                          isSelected={isSelected}
                          onValueChange={setIsSelected}
                          size="sm"
                          color="default"
                          startContent={<div>简</div>}
                          endContent={<div>全</div>}
                        />
                        <Divider orientation="vertical" />
                        <RadioGroup
                          color="default"
                          orientation="horizontal"
                          value={selected}
                          onValueChange={setSelected}
                        >
                          <Radio value="spoilerAlert">隐藏剧透</Radio>
                          <Radio value="minorSpoilers">轻微剧透</Radio>
                          <Radio value="allSpoilers">所有剧透</Radio>
                        </RadioGroup>
                      </div>

                      <div className="space-x-4 text-center mt-3">
                        {tagsdata?.tags.map((item, index) => (
                          <motion.span
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            key={index}
                            className={`inline-flex items-baseline ${item.tags.applicable !== "t" ? "hidden" : ""} ${isSelected === true ? (item.average_rating > 2.5 ? "" : "hidden") : ""} ${item.average_rating <= 0 ? "hidden" : ""} ${selected === "spoilerAlert" ? (item.average_spoiler > 0 || item.tags.defaultspoil > 0 ? "hidden" : "") : selected === "minorSpoilers" ? (item.average_spoiler > 1 || item.tags.defaultspoil > 1 ? "hidden" : "") : ""}`}
                          >
                            <Link
                              className={`text-slate-300 ${item.lie === "t" ? "line-through" : ""}`}
                              style={{
                                fontSize: `${item.average_rating * 5.5 <= 5.5 ? 7 : item.average_rating * 5.5}px`,
                              }}
                              color="primary"
                              underline="hover"
                              href={`/tags/${item.tags.gid}`}
                            >
                              {item.tags.name}
                            </Link>
                            <span
                              className="ml-1 text-slate-500"
                              style={{ fontSize: "10px" }}
                            >
                              {item.average_rating}
                            </span>
                          </motion.span>
                        ))}
                      </div>
                    </AccordionItem>
                  </Accordion>
                </motion.div>
              </>
            ) : (
              <>
                <Skeleton className="w-full justify-center h-10 rounded-lg" />
              </>
            )}
          </CardFooter>
        </Card>
      </motion.div>
    </>
  );
}
