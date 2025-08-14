"use client";
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2Icon, Pencil, Trash } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { strategyListDelete, strategyListGet } from "@/lib/strategy/strategyAc";
import { useLoginModalStore } from "./stores/EditStores";
import { StrategEdit } from "./strategyEdit";
import Link from "next/link";
// [x] 攻略列表
// [x] 攻略增删改
const StrategyList = ({ id }: { id: string }) => {
  const { data: strategyList, refetch } = useQuery({
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
  return (
    <div className="space-y-3">
      {strategyList?.map((item) => (
        <div
          key={item.id}
          className="flex w-full items-center justify-betwee space-x-2"
        >
          <Link
            className="w-full"
            href={`${item.vid || item.otherid}/${item.id}`}
          >
            <Card className="pt-2 pb-2 w-full">
              <CardContent>
                <span>{item.title}</span>
              </CardContent>
            </Card>
          </Link>
          <Button
            variant="secondary"
            size="icon"
            className="size-8"
            onClick={() => {
              setcreate(false);
              setdata({
                id: String(item.id),
                data: { title: item.title!, content: item.content! },
              });
              openModal();
            }}
          >
            <Pencil />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="size-8"
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
      ))}
      <div className="pt-2">
        <Button
          className="w-full h-11"
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
