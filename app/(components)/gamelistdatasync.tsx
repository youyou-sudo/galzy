"use client";
import React, { useEffect, useState, useMemo } from "react";
import { Gamelsit } from "./gamelist";
import { useQueryState } from "nuqs";
import { getHomeList } from "@/lib/actions/homelist";
import { Button } from "@/components/ui/button";
import Link from "next/link";

import { IoHome } from "react-icons/io5";
import { BiArrowToTop } from "react-icons/bi";
import { Card, CardBody, Skeleton } from "@nextui-org/react";

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
  totalPages,
}: {
  totalPages: number;
}) {
  const [pageData, setPageData] = useState<AllPageData | null>(null);

  const [pages, setPages] = useQueryState("pages");
  const [usepages, setUsepages] = useState<number>(Number(pages) || 1);

  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollButton(window.scrollY > 100);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Check initial position

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (pages == null) {
      const datassup = async () => {
        const newData = await getHomeList(1);
        setPageData(newData);
      };
      datassup();
    }
  }, [pages]);

  useEffect(() => {
    const datassup = async () => {
      const newData = await getHomeList(usepages + 1);
      setPageData(newData);
    };
    datassup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setUsepages(Number(pages) || 1);
  }, [pages]);

  const upgamelistdataac = async (page: number) => {
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
  };

  const memoizedGameList = useMemo(() => {
    if (!pageData) return <GameCardSkeleton />;

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
                        item.pagesss !== usepages &&
                        item.pagesss >
                          pageData.datas[pageData.datas.length - 2].pagesss
                      ) {
                        setUsepages(item.pagesss);
                        setPages(String(item.pagesss));
                        upgamelistdataac(item.pagesss + 2);
                      }
                      if (
                        entry.isIntersecting &&
                        item.pagesss < totalPages &&
                        item.pagesss !== usepages &&
                        pages !== null
                      ) {
                        setPages(String(item.pagesss));
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
  }, [pageData, totalPages, usepages, pages, setPages, upgamelistdataac]);

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

      <div className="fixed bottom-5 right-4 flex flex-col gap-2">
        {showScrollButton && (
          <>
            <Button
              size="icon"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              <BiArrowToTop />
            </Button>
          </>
        )}
        {pages && Number(pages) > 1 && (
          <Button asChild size="icon">
            <Link href="/">
              <IoHome />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

const GameCardSkeleton = () => {
  return (
    <>
      {[...Array(10)].map((_, index) => (
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
