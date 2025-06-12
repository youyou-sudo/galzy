"use client";
import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddSubDialog } from "@/components/dashboard/dataManagement/addSub";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQueryState } from "nuqs";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { dataFilteringGet } from "@/lib/dashboard/dataManagement/dataGet";
import { Button } from "@/components/ui/button";
import { SquarePen } from "lucide-react";
import { Trash2 } from "@/components/animate-ui/icons/trash-2";

export default function DataTabl() {
  const [filterNusq, setFilterNusq] = useQueryState("filter");

  // 确定请求参数
  const getRequestParams = (filterNusq: string | undefined | null) => {
    switch (filterNusq) {
      case "NoVndb":
        return { otherId: 1 };
      case "NotSupplemented":
        return { vid: 1 };
      case "Supplemented":
        return { vid: 1, otherId: 1 };
      default:
        return {};
    }
  };
  // 数据请求
  const { data: dataFilteringData, refetch } = useQuery({
    queryKey: ["dataFilteringGet", filterNusq],
    queryFn: async () => {
      const params = getRequestParams(filterNusq);
      const res = await dataFilteringGet(params);
      return res;
    },
    refetchInterval: 60000,
  });
  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center space-x-4">
              <div>数据管理</div>
              {filterNusq}
              <div className="flex ml-auto space-x-4">
                <Input placeholder="ID" />
                <Select
                  defaultValue="All"
                  onValueChange={(value) => setFilterNusq(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="筛选" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>选项</SelectLabel>
                      <SelectItem value="All">ALL</SelectItem>
                      <SelectItem value="NoVndb">NO VNDB</SelectItem>
                      <SelectItem value="NotSupplemented">
                        未补充数据
                      </SelectItem>
                      <SelectItem value="Supplemented">已补充数据</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <AddSubDialog />
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">id</TableHead>
                <TableHead>vid</TableHead>
                <TableHead>title</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataFilteringData?.data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.other}</TableCell>
                  <TableCell>{item.vid}</TableCell>
                  <TableCell>
                    {item.otherdatas?.title?.[0]?.title || "N/A"}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="size-8"
                      onClick={() => {
                        console.log("测试");
                      }}
                    >
                      <SquarePen />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="size-8 text-red-500"
                    >
                      <Trash2 animateOnHover />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
