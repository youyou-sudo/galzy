"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import type { tags, tags_vndatas } from "@/prisma/DBClient";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

import { vndbdatagsdata } from "../(action)/vndbGet";
import { BBCodeRenderer } from "@/components/bbcode";
import { useQuery } from "@tanstack/react-query";
import { getImageUrl } from "@/lib/ImageUrl";
import type { VndbdImages } from "@/lib/vndbdata";
import Image from "next/image";
export const ContentCard = ({ data }: { data: VndbdImages }) => {
  const [isSelected, setIsSelected] = useState(true);
  const [selected, setSelected] = useState("spoilerAlert");
  const { data: tagsdata } = useQuery({
    queryKey: ["tags", data.vnid],
    queryFn: () => vndbdatagsdata(data.vnid),
  });
  useEffect(() => {
    if (tagsdata?.tags) {
      const highRatedTagsCount = tagsdata.tags.filter(
        (item: tags_vndatas) => item.average_rating >= 2.5
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

  const renderTags = () => {
    if (!tagsdata?.tags) return null;
    return (tagsdata.tags as (tags_vndatas & { tags: tags })[]).map(
      (item, index) => {
        const isVisible =
          item.tags.applicable === "t" &&
          (isSelected ? item.average_rating >= 2.5 : true) &&
          item.average_rating > 0;

        const isSpoilerHidden =
          (selected === "spoilerAlert" &&
            (item.average_spoiler > 0 || Number(item.tags.defaultspoil) > 0)) ||
          (selected === "minorSpoilers" &&
            (item.average_spoiler > 1 || Number(item.tags.defaultspoil) > 1));

        if (!isVisible || isSpoilerHidden) return null;

        return (
          <div key={index} className="inline-flex items-baseline">
            <Link
              className={`hover:underline text-slate-400 ${item.lie === "t" ? "line-through" : ""}`}
              style={{
                fontSize: `${Math.max(7, item.average_rating * 5.5)}px`,
              }}
              color="primary"
              href={`/tag/${item.tags.gid}`}
            >
              {item.tags.name_zh || item.tags.name}
            </Link>
            <span className="ml-1 text-slate-500" style={{ fontSize: "10px" }}>
              {item.average_rating}
            </span>
          </div>
        );
      }
    );
  };

  return (
    <div className="mt-10 flex items-center flex-col md:flex-row">
      <div className="flex sm:items-end">
        <div className="mr-4 mb-4 border rounded-lg bg-muted text-muted shadow">
          <Image
            unoptimized
            width={Number(data.imagesData.width)}
            height={Number(data.imagesData.height)}
            className="relative w-full rounded-lg"
            src={getImageUrl(data.image, data.imagesData)}
            alt="游戏图片"
          />
        </div>
        <div className="md:hidden mb-4">
          <div className="text-sm/7 text-muted-foreground">
            {data.titles.find((item) => item.lang === data.olang)?.title}
          </div>
          <h1 className="text-xl select-all font-bold sm:text-2xl">
            {getTitle()}
          </h1>

          {data.alias.length > 0 && (
            <div className=" opacity-70 text-xs">{data.alias.join(", ")}</div>
          )}
        </div>
      </div>
      <div className="flex flex-col flex-1">
        <div className="hidden md:block">
          <div className="text-sm/7 text-muted-foreground">
            {data.titles.find((item) => item.lang === data.olang)?.title}
          </div>
          <h1 className="text-xl select-all font-bold sm:text-2xl md:text-3xl lg:text-4xl">
            {getTitle()}
          </h1>

          {data.alias.length > 0 && (
            <div className="text-sm/7 text-muted-foreground">
              {data.alias.join(", ")}
            </div>
          )}
        </div>

        <div
          id="bbccode"
          className="line-clamp-3 text-sm/7 text-muted-foreground"
        >
          <BBCodeRenderer text={data.description || ""} />
        </div>
        <div id="tags" className="hidden">
          {tagsdata ? (
            <Accordion
              type="single"
              defaultValue="item-tags"
              collapsible
              className="my-4 w-full space-y-2"
            >
              <AccordionItem
                key="tags"
                value={`item-tags`}
                className="border rounded-md px-4"
              >
                <AccordionTrigger>标签</AccordionTrigger>
                <AccordionContent>
                  <div className="flex">
                    <div className="relative inline-grid h-6 w-14 grid-cols-[1fr_1fr] items-center text-sm font-medium">
                      <Switch
                        checked={isSelected}
                        onCheckedChange={setIsSelected}
                        className="peer data-[state=unchecked]:bg-input/50 absolute inset-0 h-[inherit] w-auto [&_span]:z-10 [&_span]:h-full [&_span]:w-1/2 [&_span]:transition-transform [&_span]:duration-300 [&_span]:[transition-timing-function:cubic-bezier(0.16,1,0.3,1)] data-[state=checked]:[&_span]:translate-x-full rtl:data-[state=checked]:[&_span]:-translate-x-full"
                      />
                      <span className="pointer-events-none relative ms-0.5 flex min-w-4 items-center justify-center text-center transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] peer-data-[state=checked]:invisible peer-data-[state=unchecked]:translate-x-full rtl:peer-data-[state=unchecked]:-translate-x-full">
                        <div>全</div>
                      </span>
                      <span className="peer-data-[state=checked]:text-background pointer-events-none relative me-0.5 flex min-w-4 items-center justify-center text-center transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] peer-data-[state=checked]:-translate-x-full peer-data-[state=unchecked]:invisible rtl:peer-data-[state=checked]:translate-x-full">
                        <div>略</div>
                      </span>
                    </div>
                    <Label className="sr-only">Labeled switch</Label>

                    <Separator orientation="vertical" className="mr-2" />

                    <RadioGroup
                      onValueChange={setSelected}
                      value={selected}
                      className="flex items-center gap-3"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          value="spoilerAlert"
                          id="spoilerAlert"
                        />
                        <Label htmlFor="spoilerAlert">隐藏剧透</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          value="minorSpoilers"
                          id="minorSpoilers"
                        />
                        <Label htmlFor="minorSpoilers">轻微剧透</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="allSpoilers" id="allSpoilers" />
                        <Label htmlFor="allSpoilers">所有剧透</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="space-x-4 text-center mt-3">
                    {renderTags()}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : (
            <Skeleton className="w-full justify-center h-10 rounded-lg" />
          )}
        </div>
        <Button
          variant="link"
          onClick={(e) => {
            document
              .getElementById("bbccode")
              ?.classList.remove("line-clamp-3");

            document.getElementById("tags")?.classList.remove("hidden");
            (e.target as HTMLElement).style.display = "none";
          }}
        >
          更多信息
        </Button>
      </div>
    </div>
  );
};
