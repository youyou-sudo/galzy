"use client";
import React, { useEffect, useState } from "react";
import { Gamelsit } from "./gamelist";
import { useQueryState } from "nuqs";
import { getHomeList } from "@/lib/actions/homelist";
import { Button } from "@/components/ui/button";
import Link from "next/link";

import { IoHome } from "react-icons/io5";
import { BiArrowToTop } from "react-icons/bi";

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

  const [pages, setPages] = useQueryState("pages");
  const [usepages, setUsepages] = useState<number>(Number(pages) || 1);

  useEffect(() => {
    setUsepages(Number(pages) || 1);
  }, [pages]);

  const upgamelistdataac = async (page: number) => {
    const newData = await getHomeList(page);
    if (newData.datas.length > 0) {
      setPageData((prevData) => {
        if (newData.datas[0].pagesss < prevData.datas[0].pagesss) {
          return {
            ...prevData,
            datas: [...newData.datas, ...prevData.datas],
          };
        } else {
          return {
            ...prevData,
            datas: [...prevData.datas, ...newData.datas],
          };
        }
      });
    }
  };

  return (
    <div>
      {pageData.datas.map(
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
                          item.pagesss !== usepages
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
      )}

      <div className="fixed bottom-5 right-4">
        {typeof window !== "undefined" && window.scrollY > 100 && (
          <>
            {pages && Number(pages) > 1 ? (
              <Button asChild size="icon">
                <Link href="/">
                  <IoHome />
                </Link>
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                <BiArrowToTop />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
