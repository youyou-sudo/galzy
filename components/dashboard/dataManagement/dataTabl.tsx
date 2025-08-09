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
import Link from "next/link";

import DataManagementPagination from "@/components/dashboard/dataManagement/Pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { useFilterStore, usePaginationStore } from "./stores/dataManagement";

export default function DataTabl() {
  const filterNusq = useFilterStore((state) => state.filterNusq);
  const setFilterNusq = useFilterStore((state) => state.setFilterNusq);
  const getRequestParams = useFilterStore((state) => state.getRequestParams);
  const { datapage, limit, setDatapage, setLimit } = usePaginationStore();

  const [query, setQuery] = React.useState("");

  // 数据请求
  const { data: dataFilteringData } = useQuery({
    queryKey: ["dataFilteringGet", filterNusq, datapage, limit, query],
    queryFn: async () => {
      const params = {
        ...getRequestParams(filterNusq),
        page: datapage,
        limit,
        query: query,
      };
      const res = await dataFilteringGet(params);
      return res;
    },
    refetchInterval: 60000,
  });

  // [x] 数据翻页功能
  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center space-x-4">
              <div>数据管理</div>
              {filterNusq}
              <div className="flex ml-auto space-x-4">
                {/* [x]  数据搜索
                 */}
                <Input
                  placeholder="ID"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                  }}
                />
                <Select
                  defaultValue={filterNusq!}
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
              {dataFilteringData?.data.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.other}</TableCell>
                  <TableCell>{item.vid}</TableCell>
                  <TableCell>
                    {item.otherdatas?.title?.[0]?.title || "N/A"}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="secondary" size="icon" className="size-8">
                      <Link
                        href={`/dashboard/dataManagement/edit/${
                          item.vid || item.id
                        }`}
                      >
                        <SquarePen />
                      </Link>
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
          {dataFilteringData ? (
            <DataManagementPagination
              currentPage={dataFilteringData.pagination.page}
              totalPages={dataFilteringData.pagination.totalPages}
              setDatapage={(page: number) => setDatapage(page)}
              setLimit={(newLimit: number) => {
                setLimit(newLimit);
                setDatapage(1);
              }}
              limit={dataFilteringData.pagination.limit}
            />
          ) : (
            <div className="flex flex-col space-y-2 mt-4">
              {Array(6)
                .fill(0)
                .map((_, i) => (
                  <Skeleton key={i} className="h-[40px] rounded-xl" />
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
