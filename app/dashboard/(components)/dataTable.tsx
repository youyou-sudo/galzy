"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  useDisclosure,
  Tooltip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Select,
  SelectItem,
  Button,
  Chip,
} from "@heroui/react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import dayjs from "dayjs";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { BiDotsVerticalRounded } from "react-icons/bi";
import { TbCircleCheck, TbRefreshDot } from "react-icons/tb";
import {
  updatas,
  vndbmgetac,
  deleteProjectEntry,
  uujuuxxb,
} from "@/lib/actions/updatas";
import { useToast } from "@/components/hooks/use-toast";

export default function DataTable({ rows }: { rows: any }) {
  const { toast } = useToast();
  const router = useRouter();
  const { isOpen, onClose, onOpen, onOpenChange } = useDisclosure();

  const [rowsdata, setRowsdata] = useState(rows);
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    jsonorl: "",
    timeVersion: "",
    type: "alist",
  });
  // 数据更新函数
  const fetchUpdatedData = async () => {
    const data = await uujuuxxb();
    setRowsdata(data);
    return data;
  };

  // 如果页面有数据更新则循环检测
  useEffect(() => {
    let isCancelled = false;
    let frequentCheck = true;
    let toastTriggered = false;
    let wasPreviouslyTrue = false;
    let shouldStartPolling = false;

    const checkForUpdates = async () => {
      let lastRequestTime = Date.now();

      while (!isCancelled) {
        const currentTime = Date.now();
        if (currentTime - lastRequestTime < 5000) {
          await new Promise((resolve) =>
            setTimeout(resolve, 5000 - (currentTime - lastRequestTime))
          );
        }

        const currentData = await fetchUpdatedData();
        const hasTrueState = currentData.some((row: any) => row.state === true);

        if (hasTrueState) {
          frequentCheck = true;
          wasPreviouslyTrue = true;
          toastTriggered = false;
        } else if (wasPreviouslyTrue && !toastTriggered) {
          toast({ title: "✨主人，数据库准备就绪哦～" });
          toastTriggered = true;
          wasPreviouslyTrue = false;
        }

        lastRequestTime = Date.now();

        await new Promise((resolve) =>
          setTimeout(resolve, frequentCheck ? 2000 : 4000)
        );
      }
    };

    // 初次页面加载时，检查 rowsdata
    if (rowsdata?.some((row: any) => row.state === true)) {
      shouldStartPolling = true;
    }

    if (shouldStartPolling) {
      checkForUpdates();
    }

    return () => {
      isCancelled = true;
    };
  }, [rowsdata, toast]);

  // Modal form data setup
  const newOpenForm = () => {
    setFormData({
      id: "",
      name: "",
      jsonorl: "",
      timeVersion: "",
      type: "alist",
    });
    onOpen();
  };

  const openFrom = (row: any) => {
    setFormData(row);
    onOpen();
  };

  // Handle actions for project
  const handleRefresh = async (row: any) => {
    const result = await vndbmgetac(row);
    if (!result)
      return toast({
        variant: "destructive",
        title: "操作失败",
        description: "未收到响应",
      });

    if (result.status === "200") {
      toast({ title: "提交成功", description: JSON.stringify(result) });
      fetchUpdatedData();
    } else {
      toast({
        variant: "destructive",
        title: "提交失败",
        description: JSON.stringify(result),
      });
    }
  };

  const handleDelete = async (id: any) => {
    const result = await deleteProjectEntry(id);
    if (result.status === "200") {
      toast({ title: "删除成功", description: JSON.stringify(result) });
      router.refresh();
    } else {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: JSON.stringify(result),
      });
    }
  };

  const handleSubmit = async (formData: any) => {
    try {
      const result = await updatas(formData);
      if (result.status === "200") {
        toast({ title: "提交成功", description: JSON.stringify(result) });
        fetchUpdatedData();
        onClose();
      } else {
        toast({
          variant: "destructive",
          title: "提交失败",
          description: JSON.stringify(result),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "发生错误",
        description: JSON.stringify(error),
      });
    }
  };

  const typetxt = {
    name: "type",
    type: "type",
    option: [
      { key: "vndb", label: "vndb" },
      { key: "alist", label: "alist" },
      { key: "vndb_tags", label: "vndb_tags" },
      { key: "tags-gid-vid", label: "tags-gid-vid" },
    ],
  };

  return (
    <div>
      <CardHeader>
        <CardTitle className="flex">
          Database Table
          <Button
            className="ml-auto"
            color="primary"
            size="sm"
            variant="shadow"
            onPress={newOpenForm}
          >
            Add New
          </Button>
        </CardTitle>
      </CardHeader>

      <Card>
        <Table aria-label="Data Table">
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">Name</TableHead>
              <TableHead>JsonUrl / Webdav Url</TableHead>
              <TableHead>DB 版本 URL / 下载 Link</TableHead>
              <TableHead className="text-center">数量</TableHead>
              <TableHead className="text-center">更新时间</TableHead>
              <TableHead>类型</TableHead>
              <TableHead className="text-center">状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rowsdata?.map((row: any) => (
              <TableRow key={row.id}>
                <TableCell className="text-center">{row.name}</TableCell>
                <TableCell className="truncate max-w-24">
                  <Tooltip content={row.jsonorl}>{row.jsonorl}</Tooltip>
                </TableCell>
                <TableCell className="truncate max-w-28">
                  <Tooltip content={row.timeVersion}>{row.timeVersion}</Tooltip>
                </TableCell>
                <TableCell className="text-center">
                  {row.type === "alist"
                    ? row.counts.filessCount
                    : row.type === "vndb"
                      ? row.counts.vndbCount
                      : row.type === "tags-gid-vid"
                        ? row.counts.tagsVndatasCount
                        : row.counts.tagsCount}
                </TableCell>
                <TableCell className="text-center">
                  {dayjs(row.updatetime).format("YYYY-MM-DD HH:mm:ss")}
                </TableCell>
                <TableCell>{row.type}</TableCell>
                <TableCell className="w-16 text-center">
                  {row.state ? (
                    <Tooltip content={row.Statusdescription}>
                      <Chip
                        startContent={<TbRefreshDot size={18} />}
                        variant="flat"
                        color="warning"
                      >
                        刷新
                      </Chip>
                    </Tooltip>
                  ) : (
                    <Tooltip content={row.Statusdescription}>
                      <Chip
                        startContent={<TbCircleCheck size={18} />}
                        variant="flat"
                        color="success"
                      >
                        就绪
                      </Chip>
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell className="w-6 text-right">
                  <Dropdown>
                    <DropdownTrigger>
                      <Button isIconOnly variant="light">
                        <BiDotsVerticalRounded />
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                      disabledKeys={[
                        // row.state ? "refresh" : "",
                        row.type === "vndb" ? "delete" : "",
                      ]}
                    >
                      <DropdownItem key="edit" onClick={() => openFrom(row)}>
                        编辑
                      </DropdownItem>
                      <DropdownItem
                        key="refresh"
                        onClick={() => handleRefresh(row)}
                      >
                        刷新
                      </DropdownItem>
                      <DropdownItem
                        key="delete"
                        className="text-danger"
                        color="danger"
                        onClick={() => handleDelete(row.id)}
                      >
                        删除
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          <form action={handleSubmit}>
            <ModalHeader>编辑</ModalHeader>
            <ModalBody>
              <Input
                className="hidden"
                label="ID"
                name="id"
                defaultValue={formData.id}
              />
              <Input
                label="名称"
                name="name"
                defaultValue={formData.name}
                placeholder="DB 或目录备注"
              />
              <Input
                label="JsonUrl"
                name="jsonorl"
                defaultValue={formData.jsonorl}
                placeholder="JsonUrl 或 WebdavUrl"
              />
              <Input
                label="timeVersionURL"
                name="timeVersion"
                defaultValue={formData.timeVersion}
                placeholder="版本信息或下载链接"
              />
              <Select
                name="type"
                label={typetxt.name}
                defaultSelectedKeys={[formData.type]}
                placeholder={typetxt.type}
              >
                {typetxt.option.map((item) => (
                  <SelectItem key={item.key}>{item.label}</SelectItem>
                ))}
              </Select>
            </ModalBody>
            <ModalFooter>
              <Button type="submit" color="primary" variant="shadow">
                提交
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  );
}
