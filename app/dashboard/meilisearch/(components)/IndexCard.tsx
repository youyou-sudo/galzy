"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RiRefreshLine,
  RiEditBoxLine,
  RiCheckboxCircleFill,
  RiRunLine,
  RiErrorWarningFill,
} from "react-icons/ri";
import React, { useEffect, useState } from "react";
import {
  getIndexList,
  generateIndex,
  createIndex,
  alistVnIndexStu,
} from "../(action)/indexGet";
import { useToast } from "@/components/hooks/use-toast";
import {
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Tooltip,
  useDisclosure,
  Button,
} from "@nextui-org/react";

interface MeilisearchResponse {
  status: number;
  message: string;
  data?: MeilisearchData | null;
}

interface MeilisearchData {
  id: number;
  host: string | null;
  indexName: string | null;
  masterKey: string | null;
  adminKey: string | null;
  searchKey: string | null;
  type: string;
  primaryKey: string | null;
  Status: string | null;
  Statusdescription: string | null;
}

// 状态 常量对象
const STATUS_CONFIG = {
  就绪: {
    color: "success",
    icon: RiCheckboxCircleFill,
    label: "就绪",
  },
  执行中: {
    color: "warning",
    icon: RiRunLine,
    label: "执行中",
  },
  错误: {
    color: "danger",
    icon: RiErrorWarningFill,
    label: "错误",
  },
} as const;

export default function IndexCard({ meiliindexviwss }: any) {
  const { toast } = useToast();
  const { isOpen, onOpenChange } = useDisclosure();

  const [meiliindexviw, setMeiliindexviw] = useState(meiliindexviwss);
  const [indexstatus, setIndexstatus] = useState(true);
  const [indexname, setIndexname] = useState<MeilisearchResponse | null>(null);

  useEffect(() => {
    const alistvnGetAc = async () => {
      const data = await alistVnIndexStu();
      setIndexname(data);
    };
    alistvnGetAc();
    if (meiliindexviw.status === 200) {
      setIndexstatus(false);
    } else {
      setIndexstatus(true);
      toast({
        variant: "destructive",
        title: "╥﹏╥... ",
        description: "好像没有检测到索引呢",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 数据更新
  const dataupGet = async () => {
    const meiliindexviw = await getIndexList();
    setMeiliindexviw(meiliindexviw);
  };
  // 创建索引
  const creatindex = async () => {
    const log = await generateIndex();
    if (log.status === 200) {
      toast({
        title: "o(*////▽////*)q 啊💕！～",
        description: log.message,
      });
      dataupGet();
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
      await dataupGet();
    } else {
      toast({
        variant: "destructive",
        title: "╥﹏╥... ",
        description: log.message,
      });
    }
  };

  return (
    <div className="flex gap-3 flex-col sm:flex-row md:flex-row lg:flex-row xl:flex-row 2xl:flex-row">
      {indexstatus ? (
        <Card className="sm:w-3/6 md:w-3/6 lg:w-3/6 xl:w-3/6 2xl:w-3/6">
          <CardHeader>
            <CardTitle>无预设索引</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={creatindex}>一键生成</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="sm:w-3/6 md:w-3/6 lg:w-3/6 xl:w-3/6 2xl:w-3/6">
            <CardHeader>
              <CardTitle>All VNDB</CardTitle>
            </CardHeader>
            <CardContent>
              已建立{meiliindexviw?.data?.indexes.AllVN.numberOfDocuments}
              個索引
              <Button
                isIconOnly
                color="warning"
                variant="faded"
                isDisabled
                onPress={jmliIndex}
              >
                <RiRefreshLine />
              </Button>
            </CardContent>
          </Card>
          <Card className="sm:w-3/6 md:w-3/6 lg:w-3/6 xl:w-3/6 2xl:w-3/6">
            <CardHeader>
              <CardTitle className="flex gap-2">
                Alist $ VNDB
                {indexname && (
                  <Tooltip content={indexname.data?.Statusdescription || null}>
                    <Chip
                      startContent={(() => {
                        const Icon =
                          STATUS_CONFIG[
                            indexname.data?.Status as keyof typeof STATUS_CONFIG
                          ]?.icon || RiCheckboxCircleFill;
                        return <Icon size={18} />;
                      })()}
                      color={
                        STATUS_CONFIG[
                          indexname.data?.Status as keyof typeof STATUS_CONFIG
                        ]?.color || "default"
                      }
                      variant="faded"
                    >
                      {STATUS_CONFIG[
                        indexname.data?.Status as keyof typeof STATUS_CONFIG
                      ]?.label || "未知状态"}
                    </Chip>
                  </Tooltip>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2 items-center">
              已建立{meiliindexviw?.data.indexes.alistVN.numberOfDocuments}
              個索引
              <Button
                isIconOnly
                color="default"
                variant="faded"
                onPress={jmliIndex}
              >
                <RiEditBoxLine />
              </Button>
              <Button
                isIconOnly
                color="warning"
                variant="faded"
                onPress={jmliIndex}
              >
                <RiRefreshLine />
              </Button>
              <div>
                <Button onPress={dataupGet}>刷新页面状态</Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        isDismissable={false}
        isKeyboardDismissDisabled={true}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Modal Title
              </ModalHeader>
              <ModalBody>
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                  Nullam pulvinar risus non risus hendrerit venenatis.
                  Pellentesque sit amet hendrerit risus, sed porttitor quam.
                </p>
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                  Nullam pulvinar risus non risus hendrerit venenatis.
                  Pellentesque sit amet hendrerit risus, sed porttitor quam.
                </p>
                <p>
                  Magna exercitation reprehenderit magna aute tempor cupidatat
                  consequat elit dolor adipisicing. Mollit dolor eiusmod sunt ex
                  incididunt cillum quis. Velit duis sit officia eiusmod Lorem
                  aliqua enim laboris do dolor eiusmod. Et mollit incididunt
                  nisi consectetur esse laborum eiusmod pariatur proident Lorem
                  eiusmod et. Culpa deserunt nostrud ad veniam.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  Close
                </Button>
                <Button color="primary" onPress={onClose}>
                  Action
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
