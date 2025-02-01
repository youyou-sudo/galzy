"use client";
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Gamelsit } from "./gamelist";
import { getHomeList } from "@/lib/actions/homelist";
import { BiArrowToTop } from "react-icons/bi";
import { Button, Card, CardBody, Skeleton } from "@heroui/react";

interface FileData {
  cloud_id: number;
  id: number;
  cloudName: string | null;
  vid: string | null;
  filetype: boolean;
  is_dir: boolean;
  path: string;
  size: string;
}

interface VNData {
  filesiddatas: FileData[];
  [key: string]: any;
}

interface PageData {
  pagesss: number;
  data: VNData[];
}

interface AllPageData {
  totalCount: number;
  totalPages: number;
  datas: PageData[];
}

export default function Gamelistdatasync({
  datas,
  totalPages,
}: {
  datas: AllPageData;
  totalPages: number;
}) {
  const [pageData, setPageData] = useState<AllPageData>(datas);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const upgamelistdataac = useCallback(
    async (page: number) => {
      setIsLoading(true);
      const newData = await getHomeList(page);
      if (newData.datas.length > 0 && pageData) {
        setPageData((prevData) => {
          if (newData.datas[0].pagesss < prevData!.datas[0].pagesss) {
            return {
              ...prevData!,
              datas: [...newData.datas, ...prevData!.datas],
            };
          } else {
            return {
              ...prevData!,
              datas: [...prevData!.datas, ...newData.datas],
            };
          }
        });
      }
      setIsLoading(false);
    },
    [pageData]
  );

  const memoizedGameList = useMemo(() => {
    return pageData.datas.map(
      (item) =>
        item.data &&
        item.data.length > 0 && (
          <div
            key={item.pagesss}
            ref={(el) => {
              if (el) {
                const observer = new IntersectionObserver(
                  (entries) => {
                    entries.forEach((entry) => {
                      if (
                        entry.isIntersecting &&
                        item.pagesss < totalPages &&
                        item.pagesss >
                          pageData.datas[pageData.datas.length - 2].pagesss
                      ) {
                        upgamelistdataac(item.pagesss + 2);
                      }
                    });
                  },
                  {
                    root: null,
                    rootMargin: "0px",
                    threshold: 0.15,
                  }
                );
                observer.observe(el);
                return () => observer.disconnect();
              }
            }}
          >
            <Gamelsit datas={item.data} />
          </div>
        )
    );
  }, [pageData, totalPages, upgamelistdataac]);

  const test = false;
  if (test) {
    return (
      <div>
        <GameCardSkeleton />
      </div>
    );
  }

  return (
    <div>
      {memoizedGameList}
      {isLoading && <GameCardSkeleton />}

      <div className="fixed bottom-5 right-4 flex flex-col gap-2">
        <Button
          isIconOnly
          onPress={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <BiArrowToTop />
        </Button>
      </div>
    </div>
  );
}

const GameCardSkeleton = () => {
  return (
    <>
      {[...Array(2)].map((_, index) => (
        <Card key={index} className="flex mt-2 w-full">
          <CardBody className="flex p-3 flex-nowrap flex-row">
            <div className="w-[100px] shrink-0">
              <Skeleton className="rounded-lg">
                <div className="w-[100px] h-[140px]" />
              </Skeleton>
            </div>
            <div className="ml-3 flex-1">
              <Skeleton className="rounded-lg">
                <div className="h-3 w-3/4 mb-2" />
              </Skeleton>
              <Skeleton className="rounded-lg mt-3">
                <div className="h-4 w-1/2" />
              </Skeleton>
            </div>
          </CardBody>
        </Card>
      ))}
    </>
  );
};
