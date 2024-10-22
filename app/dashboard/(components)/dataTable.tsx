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
} from "@nextui-org/react";

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

export default function DataTable({ rows }) {
  const { toast } = useToast();
  const router = useRouter();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

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
    let shouldStartPolling = false; // 是否应该开始循环检测

    const checkForUpdates = async () => {
      let lastRequestTime = Date.now(); // 记录上一次请求的时间

      while (!isCancelled) {
        // 检查上次请求和当前时间差
        const currentTime = Date.now();
        if (currentTime - lastRequestTime < 5000) {
          // 如果请求间隔小于5秒，跳过当前轮询，等待更长时间
          await new Promise((resolve) =>
            setTimeout(resolve, 5000 - (currentTime - lastRequestTime))
          );
        }

        const currentData = await fetchUpdatedData();
        const hasTrueState = currentData.some((row) => row.state === true);

        if (hasTrueState) {
          // 有 true 状态
          frequentCheck = true;
          wasPreviouslyTrue = true;
          toastTriggered = false;
        } else if (wasPreviouslyTrue && !toastTriggered) {
          // 在从 true 状态变为全 false 时触发 toast
          toast({ title: "✨主人，数据库准备就绪哦～" });
          toastTriggered = true;
          wasPreviouslyTrue = false; // 状态回归 false
        }

        lastRequestTime = Date.now(); // 更新上次请求时间

        // 延长请求间隔（例如，4秒钟）
        await new Promise((resolve) =>
          setTimeout(resolve, frequentCheck ? 2000 : 4000)
        );
      }
    };

    // 初次页面加载时，检查 rowsdata
    if (rowsdata.some((row) => row.state === true)) {
      shouldStartPolling = true; // 第一次检测发现 true 状态，开始循环检测
    }

    if (shouldStartPolling) {
      checkForUpdates();
    }

    return () => {
      isCancelled = true; // 组件卸载时停止轮询
    };
  }, [rowsdata]); // 依赖 rowsdata 的变化

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

  const openFrom = (row) => {
    setFormData(row);
    onOpen();
  };

  // Handle actions for project
  const handleRefresh = async (row) => {
    const result = await vndbmgetac(row);
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

  const handleDelete = async (id) => {
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

  const handleSubmit = async (formData) => {
    try {
      const result = await updatas(formData);
      if (result.status === "200") {
        toast({ title: "提交成功", description: JSON.stringify(result) });
        fetchUpdatedData();
        onOpenChange(false);
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
            {rowsdata.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-center">{row.name}</TableCell>
                <TableCell className="truncate max-w-24">
                  <Tooltip content={row.jsonorl}>{row.jsonorl}</Tooltip>
                </TableCell>
                <TableCell className="truncate max-w-28">
                  <Tooltip content={row.timeVersion}>{row.timeVersion}</Tooltip>
                </TableCell>
                <TableCell className="text-center">
                  {row.type === "alist" ? row._count.filess : row._count.vndb}
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
