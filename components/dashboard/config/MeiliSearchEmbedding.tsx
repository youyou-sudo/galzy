"use client";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  meilisearchEmbeddersGet,
  meilisearchEmbeddersUpdate,
} from "@/lib/dashboard/config/meilisearch";
import { Loader2Icon } from "lucide-react";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const formSchema = z.object({
  url: z.string().url("Invalid URL"),
  model: z.string(),
  embeddingApiKey: z.string(),
  documentTemplateMaxBytes: z.number(),
  documentTemplate: z.string(),
});

export function MeiliSearchEmbedding() {
  const {
    data: meilisearchEmbeddersData,
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ["meilisearchEmbeddersGet"],
    queryFn: meilisearchEmbeddersGet,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: "",
      model: "",
      embeddingApiKey: "",
      documentTemplateMaxBytes: 400,
      documentTemplate: "",
    },
  });

  const { mutate: embeddersUpdate, isPending: updateLoading } = useMutation({
    mutationFn: async (values: {
      url: string;
      model: string;
      embeddingApiKey: string;
      documentTemplate: string;
      documentTemplateMaxBytes: number;
    }) => {
      await meilisearchEmbeddersUpdate(values);
    },
  });

  useEffect(() => {
    if (meilisearchEmbeddersData?.body?.source === "rest") {
      form.reset({
        url: meilisearchEmbeddersData.body.url,
        model: meilisearchEmbeddersData.body.request.model,
        embeddingApiKey:
          meilisearchEmbeddersData.body.headers?.Authorization || "",
        documentTemplate: meilisearchEmbeddersData.body.documentTemplate || "",
        documentTemplateMaxBytes:
          meilisearchEmbeddersData.body.documentTemplateMaxBytes || 400,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meilisearchEmbeddersData]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    embeddersUpdate(values);
    refetch();
  }
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 10 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Api url</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com" {...field} />
              </FormControl>
              <FormDescription>
                嵌入模型的调用 API （当前只支持 REST API 调用）
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="model"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Embedding 模型</FormLabel>
              <FormControl>
                <Input placeholder="BAAI/bge-m3" {...field} />
              </FormControl>
              <FormDescription>嵌入器在生成向量时使用的模型</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="embeddingApiKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Embedding Api Key</FormLabel>
              <FormControl>
                <Input placeholder="Bearer XXXXXX" {...field} />
              </FormControl>
              <FormDescription>嵌入所使用的 Embedding Api Key</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="documentTemplate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>嵌入模板</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="A movie titled {{doc.title}} whose description starts with {{doc.overview|truncatewords: 20}}"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                是一个包含 Liquid 模板的字符串。Meillisearch
                将每个文档的模板插入,并将生成的文本发送到嵌入器。然后,嵌入器根据此文本生成文档向量
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="documentTemplateMaxBytes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>嵌入模板字节限制</FormLabel>
              <FormControl>
                <Input placeholder="400" {...field} />
              </FormControl>
              <FormDescription>
                渲染文档模板的最大大小。较长的文本被截断以符合配置的限制
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">
          {updateLoading && <Loader2Icon className="animate-spin" />}
          提交配置
        </Button>
      </form>
    </Form>
  );
}
