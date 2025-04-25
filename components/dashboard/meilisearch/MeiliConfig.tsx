"use client";
import React, { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  meilidataupGet,
  meiliconfigGet,
  meilidatasGet,
} from "@/lib/meilisearch/upmeili";

import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import type { meilisearchdatas } from "@/prisma/DBClient";
import { Code } from "@/components/Code";

const formSchema = z.object({
  id: z.string({ message: "非法 ID" }),
  host: z.string().url({ message: "请输入 meiliSearch Api 地址" }),
  masterKey: z.string({ message: "请符合要求的输入 masterKey" }),
  type: z.string({ message: "非法 Type" }),
  indexName: z.string({ message: "需要正确的索引名称" }),
});

export default function MeiliConfig() {
  const [onOpen, setOnOpen] = useState(false);

  const { data: meiliConfig, refetch } = useQuery({
    queryKey: ["meiliData"],
    queryFn: () => meiliconfigGet(),
  });

  if (meiliConfig?.error) {
    toast.error(`${meiliConfig.message}`, {
      description: JSON.stringify(meiliConfig.error, null, 2),
    });
  }
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: meiliConfig?.data?.id || "",
      host: meiliConfig?.data?.host || "",
      masterKey: meiliConfig?.data?.masterKey || "",
      type: "config",
      indexName: "",
    },
  });
  async function onSubmit(values: z.infer<typeof formSchema>) {
    const result = await meilidataupGet({
      id: values.id,
      host: values.host,
      masterKey: values.masterKey,
      indexName: values.indexName,
    });

    if (result.statusCode === 200 || result.statusCode === 201) {
      toast.success(`${result.message}`);
      setOnOpen(false);
      refetch();
    } else {
      toast.error(`${result.message}`, {
        description: JSON.stringify(result.error, null, 2),
      });
    }
  }

  async function keyGetAc(data: meilisearchdatas) {
    const getLog = await meilidatasGet(data);
    if (getLog.status === "200") {
      toast.success("(*^▽^*) Key 获取成功", {
        description: getLog.message,
      });
      refetch();
    } else {
      toast.error("╮(╯▽╰)╭ Key 获取失败", {
        description: getLog.message,
      });
    }
  }

  return (
    <>
      {/* 配置查看与编辑 Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex">
            meilisearch
            {meiliConfig ? (
              <Button className="mr-0 ml-auto" onClick={() => setOnOpen(true)}>
                编辑配置
              </Button>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {meiliConfig ? (
            <>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>查看 adminKey</AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-col gap-2">
                      <div>
                        MeiliSearch masterKey:
                        <Code code={meiliConfig?.data?.masterKey || ""} />
                      </div>

                      {meiliConfig?.data?.adminKey ? (
                        <>
                          <div>
                            MeiliSearch adminKey:{" "}
                            <Code code={meiliConfig.data.adminKey} />
                          </div>
                          <div>
                            MeiliSearch searchKey:
                            <Code code={meiliConfig.data.searchKey || ""} />
                          </div>
                        </>
                      ) : (
                        <>还未获取到 adminKey / searchKey</>
                      )}
                      {meiliConfig?.data && (
                        <Button
                          className="w-full"
                          onClick={() =>
                            meiliConfig.data && keyGetAc(meiliConfig.data)
                          }
                        >
                          获取 / 刷新 KEY
                        </Button>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </>
          ) : (
            <div>
              未配置，请
              <Button onClick={() => setOnOpen(true)}>添加配置</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form 表单窗口 */}
      <Dialog open={onOpen} onOpenChange={setOnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑配置</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
              <FormField
                control={form.control}
                name="host"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>meiliSearch host</FormLabel>
                    <FormControl>
                      <Input placeholder="http://localhost:7700/" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="masterKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>master Key</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="masterKey 后续会自动获取其他 Key"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit">提交</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
