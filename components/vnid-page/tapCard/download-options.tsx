"use client";

import type React from "react";

import { Download, InfoIcon } from "lucide-react";

import { File, Folder, Files } from "@/components/animate-ui/components/files";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

type fileList = Awaited<ReturnType<typeof getFileList>>;

export function DownloadOptions({ fileList }: { fileList: fileList }) {
  return (
    <>
      <FileExplorer items={fileList} />
      <Alert className="border-cyan-600/50 text-cyan-600 dark:border-cyan-600 [&>svg]:text-cyan-600">
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>本站下载已配置负载均衡以保证速度</AlertDescription>
      </Alert>
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
    <Files className="border-0 mb-0">
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>文件信息</DialogTitle>
        </DialogHeader>
        <span className="text-center text-lg">{data?.name}</span>

        <DialogDescription className="flex flex-col gap-2">
          <span className="text-center">{formatBytes(Number(data?.size))}</span>
        </DialogDescription>
        <DialogFooter className="flex gap-2 sm:justify-center">
          <Button
            onClick={() => close()}
            variant="secondary"
            className="text-red-400"
          >
            关闭
          </Button>
          <Button asChild>
            <Link target="_blank" href={`/download?path=${data?.sign}`}>
              <div className="flex items-center">
                <Download />
                下载
              </div>
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
