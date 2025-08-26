"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2Icon, Pencil, Trash } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/animate-ui/radix/dialog";
import { useMutation, useQuery } from "@tanstack/react-query";
import { strategyListDelete, strategyListGet } from "@/lib/strategy/strategyAc";
import { useLoginModalStore } from "./stores/EditStores";
import { StrategEdit } from "./strategyEdit";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useStrategyListDialog } from "../stores/strategyListModal";
import { MotionHighlight } from "@/components/animate-ui/effects/motion-highlight";

import { usePathname } from "next/navigation";
// [x] 攻略列表
// [x] 攻略增删改
const StrategyList = ({ id }: { id: string }) => {
  const {
    data: strategyList,
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ["strategyList", id],
    queryFn: () => strategyListGet(id),
  });

  const { mutate: SubmitAc, isPending: SubmitAcLoading } = useMutation({
    mutationFn: async (values: string) => {
      try {
        await strategyListDelete(values);
        await refetch();
      } catch (e) {
        console.log(e);
      }
    },
  });

  const { setdata, setcreate, openModal } = useLoginModalStore();
  const pathname = usePathname();
  return (
    <div>
      <div className="flex flex-col p-3">
        {isLoading && (
          <>
            {Array(2)
              .fill(null)
              .map((_, index) => (
                <Skeleton key={index} className="h-[40px] w-full" />
              ))}
          </>
        )}
        {strategyList && (
          <MotionHighlight hover className="rounded-lg">
            {strategyList.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-2 space-x-2 rounded-lg"
              >
                <Link
                  className="w-full"
                  href={
                    pathname === "/dashboard/dataManagement"
                      ? `/${id}/${item.id}`
                      : `${item.id}`
                  }
                >
                  <div className="pt-2 pb-2 w-full">
                    <span>{item.title}</span>
                  </div>
                </Link>

                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8"
                    onClick={() => {
                      setcreate(false);
                      setdata({
                        id: String(item.id),
                        data: {
                          title: item.title!,
                          content: item.content!,
                          copyright: item.copyright,
                        },
                      });
                      openModal();
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8"
                    onClick={() => {
                      SubmitAc(String(item.id));
                    }}
                  >
                    {SubmitAcLoading ? (
                      <Loader2Icon className="animate-spin" />
                    ) : (
                      <Trash />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </MotionHighlight>
        )}
      </div>

      <div className="pt-2 items-center justify-center p-3">
        <Button
          className="h-11 w-full"
          variant="outline"
          size="sm"
          onClick={() => {
            openModal();
            setdata({ id: id });
            setcreate(true);
          }}
        >
          <Pencil />
          添加攻略文章
        </Button>
      </div>
      <StrategEdit />
    </div>
  );
};

export default StrategyList;

export const StrategyListModal = () => {
  const { isOpen, toggleModal, id } = useStrategyListDialog();
  return (
    <Dialog open={isOpen} onOpenChange={toggleModal}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>攻略列表</DialogTitle>
        </DialogHeader>
        <StrategyList id={id!} />
      </DialogContent>
    </Dialog>
  );
};
