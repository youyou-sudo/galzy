"use client";

import type React from "react";

import { Download } from "lucide-react";

import { File, Folder, Files } from "@/components/animate-ui/components/files";
import { getFileList, TreeNode } from "@/lib/repositories/alistFileList";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/animate-ui/radix/dialog";
import { downCardDataStore } from "./stores/downCardData";
import Link from "next/link";
import { Card } from "@/components/ui/card";

type fileList = Awaited<ReturnType<typeof getFileList>>;

export function DownloadOptions({ fileList }: { fileList: fileList }) {
  return (
    <>
      <FileExplorer items={fileList} />
    </>
  );
}

function FileExplorer({ items }: { items: fileList }) {
  const simplifiedItems = (() => {
    if (
      items.length === 1 &&
      items[0].type === "folder" &&
      Array.isArray(items[0].children)
    ) {
      return items[0].children;
    }
    return items;
  })();

  return (
    <Files
      // defaultOpen={["PC", "KR", "ONS", "TY"]}
      defaultOpen={["PC", "KR", "ONS", "TY", "CG"]}
      className="bg-transparent border-0 mb-2"
    >
      <DownCardDialog />
      <Filessss items={simplifiedItems} />
    </Files>
  );
}

const Filessss = ({ items }: { items: fileList }) => {
  const open = downCardDataStore((s) => s.open);
  const setData = downCardDataStore((s) => s.setData);
  const FileClick = (item: TreeNode) => {
    setData(item);
    open();
  };
  return (
    <>
      {items.map((item) =>
        item.type === "folder" ? (
          <Folder name={item.name} key={item.name}>
            {item.children && <Filessss items={item.children} />}
          </Folder>
        ) : (
          <File
          className="underline underline-offset-4 hover:decoration-sky-500"
            name={item.name}
            key={item.name}
            onClick={() => {
              FileClick(item);
            }}
          />
        )
      )}
    </>
  );
};

export const DownCardDialog = () => {
  const isOpen = downCardDataStore((s) => s.isOpen);
  const setOpen = downCardDataStore((s) => s.setOpen);
  const data = downCardDataStore((s) => s.data);
  const close = downCardDataStore((s) => s.close);

  // Size 转换
  function formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return "0 字节";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["字节", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }
  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85%]">
        <DialogHeader>
          <DialogTitle>文件信息</DialogTitle>
        </DialogHeader>
        <span className="text-center text-lg break-words">{data?.name}</span>

        <DialogDescription className="text-center">
          <span>{formatBytes(Number(data?.size))}</span>
        </DialogDescription>
        <DialogFooter className="flex gap-2 sm:justify-center">
          <Button
            onClick={() => close()}
            variant="secondary"
            className="text-red-500"
          >
            关闭
          </Button>
          <Button asChild>
            <Link
              data-umami-event="GameDownload"
              data-umami-event-pathe={data?.id}
              data-umami-event-size={data?.size}
              target="_blank"
              href={`/api/download?path=${data?.id}`}
            >
              <div className="flex items-center">
                <Download />
                下载
              </div>
            </Link>
          </Button>
        </DialogFooter>

        {/* Card 内部滚动 */}
        <Card className="max-h-96 overflow-y-auto mt-4 p-2 break-words">
          {[...Array(60)].map((_, i) => (
            <div key={i}>
              1111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111
            </div>
          ))}
        </Card>
      </DialogContent>
    </Dialog>
  );
};
