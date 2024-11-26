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
import Link from "next/link";
import { env } from "next-runtime-env";

interface Title {
  lang: string;
  title: string;
  official?: string;
}

interface Tag {
  average_rating: number;
  average_spoiler: number;
  lie: string;
  tags: {
    applicable: string;
    defaultspoil: number;
    gid: string;
    name: string;
  };
}

interface VNData {
  vnid: string;
  image: string;
  titles: Title[];
  olang: string;
  alias: string[];
}

interface ContentCardProps {
  data: VNData;
  fullsereenfill?: boolean;
}

export function ContentCard({ data, fullsereenfill }: ContentCardProps) {
  const [tagsdata, setTagsdata] = useState<{ tags: Tag[] }>();
  const [isSelected, setIsSelected] = useState(true);
  const [selected, setSelected] = useState("spoilerAlert");

  useEffect(() => {
    const fetchTagsData = async () => {
      const result = await vndbdatagsdata(data);
      setTagsdata(result);
    };
    fetchTagsData();
  }, [data]);

  useEffect(() => {
    if (tagsdata?.tags) {
      const highRatedTagsCount = tagsdata.tags.filter(
        (item) => item.average_rating > 2.5
      ).length;
      setIsSelected(highRatedTagsCount >= 2);
    }
  }, [tagsdata]);

  const getTitle = () => {
    const zhTitle = data.titles.find((item) => item.lang === "zh-Hans")?.title;
    const officialTitle = data.titles.find(
      (item) => item.official === "t"
    )?.title;
    return zhTitle || officialTitle;
  };

  const getImageUrl = () => {
    const { image } = data;
    return `${env(
      "NEXT_PUBLIC_VNDBIMG_URI"
    )}/${image.substring(0, 2)}/${image.slice(-2)}/${image.slice(2)}.jpg`;
  };

  const renderTags = () => {
    if (!tagsdata?.tags) return null;

    return tagsdata.tags.map((item, index) => {
      const isVisible =
        item.tags.applicable === "t" &&
        (isSelected ? item.average_rating > 2.5 : true) &&
        item.average_rating > 0;

      const isSpoilerHidden =
        (selected === "spoilerAlert" &&
          (item.average_spoiler > 0 || item.tags.defaultspoil > 0)) ||
        (selected === "minorSpoilers" &&
          (item.average_spoiler > 1 || item.tags.defaultspoil > 1));

      if (!isVisible || isSpoilerHidden) return null;

      return (
        <motion.span
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          key={index}
          className="inline-flex items-baseline"
        >
          <Link
            className={`hover:underline text-slate-400 ${item.lie === "t" ? "line-through" : ""}`}
            style={{
              fontSize: `${Math.max(7, item.average_rating * 5.5)}px`,
            }}
            color="primary"
            href={`/tag/${item.tags.gid}`}
            prefetch={true}
          >
            {item.tags.name}
          </Link>
          <span className="ml-1 text-slate-500" style={{ fontSize: "10px" }}>
            {item.average_rating}
          </span>
        </motion.span>
      );
    });
  };

  return (
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
              src={getImageUrl()}
              fallbackSrc="https://dummyimage.com/679x481/9e9e9e/fff"
              alt="游戏图片"
              loading="lazy"
            />
          </div>
          <div className="flex flex-col">
            <div>
              <Tooltip content="zh_title or official title">
                <h1 className="text-xl select-all font-bold sm:text-2xl md:text-3xl lg:text-4xl">
                  {getTitle()}
                </h1>
              </Tooltip>

              <div className="italic opacity-70 select-all">
                {data.titles.find((item) => item.lang === data.olang)?.title}
              </div>

              <Tooltip content="Alias">
                {data.alias.length > 0 && (
                  <div className="italic opacity-70 text-xs">
                    {data.alias.join(", ")}
                  </div>
                )}
              </Tooltip>
            </div>
            <Platform datas={data} />
          </div>
          {fullsereenfill && (
            <Button
              as={Link}
              href={`/${data.vnid}`}
              prefetch={true}
              scroll={false}
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
            <motion.div
              className="w-full"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Accordion isCompact>
                <AccordionItem key="1" aria-label="TAG" title="TAG">
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
                    {renderTags()}
                  </div>
                </AccordionItem>
              </Accordion>
            </motion.div>
          ) : (
            <Skeleton className="w-full justify-center h-10 rounded-lg" />
          )}
        </CardFooter>
      </Card>
    </motion.div>
  );
}
