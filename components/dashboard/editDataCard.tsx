"use client";
import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CircleCheck,
  FileCog,
  GripVertical,
  HardDriveDownload,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { z } from "zod";
import { useToast } from "@/components/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { duptimes } from "@prisma/client";
import { distinguishAndUpdate } from "@/lib/task/workerEntrance";
import { coutAcQ, dataUpQ } from "@/app/dashboard/(action)/dataAc";
import { useQuery } from "@tanstack/react-query";
import EditDataForm from "./editDataForm";

export default function EditDataCard({
  data,
  count,
}: {
  data: duptimes;
  count: { type: string; count: number }[] | undefined;
}) {
  // 数据轮询部分
  const [datas, setDatas] = useState(data);
  const [couddatas, setCoutdatas] = useState(
    Array.isArray(count)
      ? count.find((item) => item.type === datas.type)
      : undefined
  );
  const [lyxy, setLyxy] = useState(data.state || false);

  const { data: Qdatas, refetch } = useQuery({
    queryKey: ["dashListData"],
    queryFn: () => dataUpQ(),
    refetchInterval: lyxy ? 3000 : false,
  });
  const { data: coutdata } = useQuery({
    queryKey: ["dashListCountData"],
    queryFn: () => coutAcQ(),
    refetchInterval: lyxy ? 3000 : false,
  });

  useEffect(() => {
    if (Qdatas) {
      const foundData = Qdatas.find((item) => item.id === datas.id);
      if (foundData) {
        setDatas(foundData);
      }
    }
    if (coutdata) {
      setCoutdatas(coutdata.counts.find((item) => item.type === datas.type));
    }
  }, [Qdatas, coutdata, datas.id, datas.type]);

  useEffect(() => {
    if (datas.state && !lyxy) {
      setLyxy(true);
    }
  }, [datas.state, lyxy]);

  const { toast } = useToast();
  const [modal, setModal] = useState(false);

  async function onSubmit(
    values: z.infer<typeof import("@/schemas/formSchema").formSchemaVndb>
  ) {
    const datass = {
      id: datas?.id ?? "",
      jsonurl: values.jsonurl,
      name: values?.name,
      timeVersion: values.timeVersion,
      type: datas?.type,
      state: false,
      updatetime: new Date(),
      Statusdescription: "",
    };
    const log = await import("@/lib/actions/updatas").then((m) =>
      m.updatas(datass)
    );
    refetch();
    if (log.status === "200") {
      toast({ title: `${log.msess}` });
      setModal(false);
    } else {
      toast({ variant: "destructive", title: `${log.msess}` });
    }
  }

  // 脚本运行
  const vndbmgetac = async () => {
    const log = await distinguishAndUpdate({
      id: datas?.id ?? "",
      name: datas?.name,
      timeVersion: datas?.timeVersion ?? "",
      jsonurl: datas?.jsonurl ?? "",
      type: datas?.type,
    });
    refetch();

    if (log.status === "200") {
      toast({ title: `${log.message}` });
    } else {
      toast({ variant: "destructive", title: `${log.message}` });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {datas.name}
            <Button variant="ghost" size="icon" onClick={() => setModal(true)}>
              <FileCog />
            </Button>
          </CardTitle>
          <CardDescription>{datas.type}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          {datas.state === false ? (
            <CircleCheck className="text-green-500" />
          ) : (
            <RefreshCw className="animate-spin text-yellow-500" />
          )}
          {couddatas?.count ? `对象计数：${couddatas.count}` : "数量获取中"}
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          <div>
            {datas?.updatetime
              ? new Date(datas?.updatetime).toLocaleString()
              : "未知"}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <GripVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>操作</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => vndbmgetac()}>
                <HardDriveDownload />
                更新数据
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Trash2 />
                删除数据
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardFooter>
      </Card>
      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>数据更新源</DialogTitle>
            <DialogDescription></DialogDescription>
          </DialogHeader>
          {/* 使用新分离出的表单组件 */}
          <EditDataForm
            initialValues={{
              name: datas?.name ?? "",
              jsonurl: datas?.jsonurl ?? "",
              timeVersion: datas?.timeVersion ?? "",
              type: datas?.type ?? "",
            }}
            onSubmit={onSubmit}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
