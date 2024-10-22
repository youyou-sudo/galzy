"use client";
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionItem } from "@nextui-org/react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  useDisclosure,
  ModalBody,
  ModalFooter,
  Input,
  Button,
  Code,
} from "@nextui-org/react";
import {
  meilidataupGet,
  meiliconfigGet,
  meilidatasGet,
} from "../(action)/upmeili";
import { useToast } from "@/components/hooks/use-toast";

export default function MeiliConfig({ meilisearchconfig }) {
  const { toast } = useToast();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const [meiliConfig, setMeiliconfig] = useState(meilisearchconfig);
  const [formData, setFormData] = useState({
    id: "",
    host: "",
    masterKey: "",
    indexName: "",
    type: "index",
  });
  const configDataSetGet = async () => {
    const data = await meiliconfigGet();
    setMeiliconfig(data.data);
  };

  const handleSubmit = async (formData) => {
    const data = await meilidataupGet(formData);
    toast({
      title: "操作已提交",
      description: JSON.stringify(data),
    });
    configDataSetGet();
    onOpenChange(false);
  };

  const eitconfig = () => {
    setFormData({
      id: meiliConfig.id,
      host: meiliConfig.host,
      masterKey: meiliConfig.masterKey,
      indexName: meiliConfig.indexName,
      type: "config",
    });
    onOpen();
  };

  const addconfig = () => {
    setFormData({
      id: "",
      host: "",
      masterKey: "",
      indexName: "",
      type: "config",
    });
    onOpen();
  };

  const KeyPostDB = async (id, host, masterKey) => {
    const key = await meilidatasGet({ id, host, masterKey });
    if (key.status === "200") {
      toast({
        title: "(*^▽^*)",
        description: key.message,
      });
    } else {
      toast({
        variant: "destructive",
        title: "o(TヘTo) ",
        description: key.message,
      });
    }

    configDataSetGet();
  };

  return (
    <>
      {/* 配置查看与编辑 Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex">
            meilisearch
            {meiliConfig ? (
              <Button
                className="mr-0 ml-auto"
                onPress={eitconfig}
                color="primary"
                variant="shadow"
              >
                编辑配置
              </Button>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {meiliConfig ? (
            <>
              <Accordion isCompact>
                <AccordionItem
                  key="1"
                  aria-label="查看 Meilisearch key"
                  title={meiliConfig.host}
                  subtitle="点击查看 KEY"
                >
                  <div className="flex flex-col gap-2">
                    {meiliConfig.adminKey?.length > 0 ? (
                      <>
                        <div>
                          MeiliSearch masterKey:{" "}
                          <Code>{meiliConfig.masterKey}</Code>
                        </div>
                        <div>
                          MeiliSearch adminKey:{" "}
                          <Code>{meiliConfig.adminKey}</Code>
                        </div>
                        <div>
                          MeiliSearch searchKey:
                          <Code>{meiliConfig.searchKey}</Code>
                        </div>
                      </>
                    ) : (
                      <>还未获取到 adminKey / searchKey</>
                    )}
                    <Button
                      className="w-full"
                      onPress={() =>
                        KeyPostDB(
                          meiliConfig.id,
                          meiliConfig.host,
                          meiliConfig.masterKey
                        )
                      }
                    >
                      获取 / 刷新 KEY
                    </Button>
                  </div>
                </AccordionItem>
              </Accordion>
            </>
          ) : (
            <div>
              未配置，请
              <Button onClick={addconfig} color="primary" variant="shadow">
                添加配置
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form 表单窗口 */}
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
                label="host"
                name="host"
                defaultValue={formData.host}
                placeholder="host"
              />
              <Input
                label="masterKey"
                name="masterKey"
                defaultValue={formData.masterKey}
                placeholder="masterKey 后续会自动获取其他 Key"
              />
              <Input
                className={formData.type == "index" ? "block" : "hidden"}
                label="indexName"
                name="indexName"
                defaultValue={formData.indexName}
                placeholder="索引 Name"
              />
              <Input
                className="hidden"
                name="type"
                defaultValue={formData.type}
              />
            </ModalBody>
            <ModalFooter>
              <Button type="submit" color="primary" variant="shadow">
                提交
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}
