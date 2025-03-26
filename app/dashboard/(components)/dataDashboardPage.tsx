"use client";

import EditDataCard from "@/components/dashboard/editDataCard";
import { useQuery } from "@tanstack/react-query";
import { coutAcQ, dataUpQ } from "../(action)/dataAc";
import { FloatingButton } from "./floating-button";
import { Plus } from "lucide-react";
import { useState } from "react";

import { useToast } from "@/components/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import EditDataForm from "@/components/dashboard/editDataForm";
import type { z } from "zod";

export function DataDashboardPage() {
  const { toast } = useToast();
  const [modal, setModal] = useState(false);

  const { data: datas, refetch } = useQuery({
    queryKey: ["dashListData"],
    queryFn: () => dataUpQ(),
  });
  const { data: count } = useQuery({
    queryKey: ["dashListCountData"],
    queryFn: () => coutAcQ(),
  });

  async function onSubmit(
    values: z.infer<typeof import("@/schemas/formSchema").formSchemaVndb>
  ) {
    const datass = {
      id: "",
      jsonurl: values.jsonurl,
      name: values.name,
      timeVersion: values.timeVersion,
      type: values.type,
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
  return (
    <>
      <div className="columns-1 md:columns-2 lg:columns-4 gap-2">
        {datas?.map((item) => (
          <div className="break-inside-avoid mb-2" key={item.type}>
            <EditDataCard data={item} count={count?.counts} />
          </div>
        ))}
      </div>
      <FloatingButton
        icon={<Plus className="h-6 w-6" />}
        onClick={() => setModal(true)}
      />
      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>数据更新源</DialogTitle>
            <DialogDescription></DialogDescription>
          </DialogHeader>
          {/* 使用新分离出的表单组件 */}
          <EditDataForm
            initialValues={{
              name: "",
              jsonurl: "",
              timeVersion: "",
              type: "",
            }}
            onSubmit={onSubmit}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
