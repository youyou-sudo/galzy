"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Dialog,
    DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/animate-ui/radix-dialog';
import { Progress } from "@/components/ui/progress";

import type { FormattedNode } from "../(action)/alistFIleGet";
import Errors from "@/components/error";

export function FileDownloadDialog({
  onOpen,
  onOpenChange,
  data,
  dlink,
}: {
  onOpen: boolean;
  onOpenChange: (open: boolean) => void;
  data: FormattedNode[] | FormattedNode | undefined;
  dlink: string;
}) {
  // Size 转换
  function formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return "0 字节";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["字节", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }

  const [downloadedCount, setDownloadedCount] = useState<string[]>([]);

  if (!data) {
    return (
      <Dialog open={onOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>出错啦</DialogTitle>
          </DialogHeader>
          <Errors
            code="500"
            errormessage={{
              message: "服务器内部错误",
              details: "发生了一些错误",
            }}
          ></Errors>
        </DialogContent>
      </Dialog>
    );
  }
  if (Array.isArray(data)) {
    // 处理分卷下载
    const totalParts = data.length;
    const downloadedlength = downloadedCount.length;
    const progress = (downloadedlength / totalParts) * 100;

    return (
      <Dialog open={onOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>分卷下载</DialogTitle>
            <DialogDescription>
              此文件被分成多个部分，请分别下载每个部分。
            </DialogDescription>
          </DialogHeader>
          <div className="mt-0 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">总体进度</span>
              <span className="text-sm text-muted-foreground">
                {downloadedlength}/{totalParts} 部分
              </span>
            </div>
            <Progress value={progress} className="h-2" />

            <div className="rounded-md border">
              {data.map((part) => (
                <div
                  key={part.path}
                  className={`flex items-center justify-between p-4 ${
                    downloadedCount.includes(part.path)
                      ? "bg-green-600/20 text-green-600 rounded-sm"
                      : ""
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{part.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatBytes(part.size)}
                    </span>
                  </div>
                  <Button asChild variant="outline">
                    <Link
                      target="_blank"
                      href={`${dlink}${part.path}?sign=${part.sign}`}
                      onClick={() =>
                        setDownloadedCount((prev) => [
                          ...new Set([...prev, part.path]),
                        ])
                      }
                    >
                      <div className="flex items-center gap-2">
                        <Download />
                        下载
                      </div>
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  } else {
    return (
      <Dialog open={onOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader className="items-center">
            <DialogTitle className="flex flex-col gap-1">文件详情</DialogTitle>
          </DialogHeader>
          <DialogDescription className="flex flex-col gap-2">
            <span className="text-center text-lg">{data.name}</span>
            <span className="text-center">
              {formatBytes(Number(data.size))}
            </span>
          </DialogDescription>
          <DialogFooter className="flex gap-2 sm:justify-center">
            <Button
              onClick={() => onOpenChange(false)}
              variant="secondary"
              className="text-red-400"
            >
              关闭
            </Button>
            <Button asChild>
              <Link
                target="_blank"
                href={`${dlink}${data.path}?sign=${data.sign}`}
              >
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
  }
}
