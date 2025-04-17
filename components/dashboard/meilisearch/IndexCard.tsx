"use client";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import React, { useEffect, useState } from "react";
import {
  getIndexList,
  generateIndex,
  createIndex,
} from "@/lib/meilisearch/indexGet";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {  RefreshCcw } from "lucide-react";

export default function IndexCard() {
  const { toast } = useToast();
  const [indexstatus, setIndexstatus] = useState(true);

  const { data: meiliindexviw, refetch } = useQuery({
    queryKey: ["IndexData"],
    queryFn: () => getIndexList(),
    staleTime: 60 * 100,
  });

  useEffect(() => {
    if (meiliindexviw?.status === 200) {
      setIndexstatus(false);
    } else {
      setIndexstatus(true);
      toast({
        variant: "destructive",
        title: "╥﹏╥... ",
        description: "好像没有检测到索引呢",
      });
    }
  }, [meiliindexviw, toast]);

  // 创建索引
  const creatindex = async () => {
    const log = await generateIndex();
    if (log.status === 200) {
      toast({
        title: "o(*////▽////*)q 啊💕！～",
        description: log.message,
      });
      refetch();
    } else {
      toast({
        variant: "destructive",
        title: "╥﹏╥... ",
        description: log.message,
      });
    }
  };
  // 建立索引
  const jmliIndex = async () => {
    const log = await createIndex("alistVN");
    if (log.status === 200) {
      toast({
        title: "(*^▽^*)",
        description: log.message,
      });
      await refetch();
    } else {
      toast({
        variant: "destructive",
        title: "╥﹏╥... ",
        description: log.message,
      });
    }
  };

  return (
    <>
      {indexstatus ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              无预设索引
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={creatindex}>一键生成</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Alist $ VNDB
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              对象计数：{meiliindexviw?.data.indexes.alistVN.numberOfDocuments}
            </CardContent>
            <CardFooter className="flex items-center justify-end gap-2">
              <Button onClick={jmliIndex}>
                <RefreshCcw />
                同步索引
              </Button>
            </CardFooter>
          </Card>
        </>
      )}
    </>
  );
}
