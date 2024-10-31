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
import { Button } from "@/components/ui/button";
import {
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Tooltip,
  useDisclosure,
} from "@nextui-org/react";

export default function IndexCard({ meiliindexviwss }) {
  const { toast } = useToast();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const [meiliindexviw, setMeiliindexviw] = useState(meiliindexviwss);
  const [indexstatus, setIndexstatus] = useState(true);
  const [indexname, setIndexname] = useState("");

  useEffect(() => {
    const alistvnGetAc = async () => {
      const data: any = await alistVnIndexStu();
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
              已建立{meiliindexviw?.data.indexes.AllVN.numberOfDocuments}
              個索引
              <Button
                isIconOnly
                color="warning"
                variant="faded"
                isDisabled
                onClick={jmliIndex}
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
                  <>
                    {(() => {
                      const status = indexname?.data.Status;
                      let chipProps = {
                        startContent: <RiCheckboxCircleFill size={18} />,
                        variant: "faded",
                        children: "未知状态", // 默认状态
                      };
                      let tooltipProps = {
                        content: null,
                      };

                      if (status === "就绪") {
                        chipProps.color = "success";
                        chipProps.children = "就绪";
                        tooltipProps.content =
                          indexname?.data.Statusdescription;
                        chipProps.startContent = (
                          <RiCheckboxCircleFill size={18} />
                        );
                      } else if (status === "执行中") {
                        chipProps.color = "warning";
                        chipProps.children = "执行中";
                        tooltipProps.content =
                          indexname?.data.Statusdescription;
                        chipProps.startContent = <RiRunLine size={18} />;
                      } else if (status === "错误") {
                        chipProps.color = "danger";
                        tooltipProps.content =
                          indexname?.data.Statusdescription;
                        chipProps.children = "错误";
                        chipProps.startContent = (
                          <RiErrorWarningFill size={18} />
                        );
                      }

                      return (
                        <Tooltip {...tooltipProps}>
                          <Chip {...chipProps} />
                        </Tooltip>
                      );
                    })()}
                  </>
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
                onClick={jmliIndex}
              >
                <RiEditBoxLine />
              </Button>
              <Button
                isIconOnly
                color="warning"
                variant="faded"
                onClick={jmliIndex}
              >
                <RiRefreshLine />
              </Button>
              <div>
                <Button onClick={dataupGet}>刷新页面状态</Button>
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
                <Button color="danger" variant="light" onClick={onClose}>
                  Close
                </Button>
                <Button color="primary" onClick={onClose}>
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
