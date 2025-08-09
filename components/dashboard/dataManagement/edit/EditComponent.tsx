"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Plus, Trash2 } from "lucide-react";
import ImageUpComp from "./imageUp";
import {
  vidassociationGet,
  vidassociationUpdate,
} from "@/lib/dashboard/dataManagement/dataGet";
import { Skeleton } from "@/components/ui/skeleton";

// 定义表单验证模式
const formSchema = z.object({
  title: z.array(
    z.object({
      title: z.string({
        message: "标题需为字符串",
      }),
      lang: z.string({
        message: "请选择语言",
      }),
    })
  ),
  alias: z.string().optional().nullable(),
  description: z.string({
    message: "非法描述",
  }),
});

type FormValues = z.infer<typeof formSchema>;

type DataTy = Awaited<ReturnType<typeof vidassociationGet>>;

export default function EditComponent({ data }: { data: DataTy }) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: data?.title || [{ title: "", lang: "" }],
      description: data?.description || "",
      alias: data?.alias || "",
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "title",
  });

  const onSubmit = async (values: FormValues) => {
    await vidassociationUpdate(Number(data!.id), values);
  };

  const addTitleItem = () => {
    append({ title: "", lang: "" });
  };

  const removeAlistItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };
  if (!data) {
    return (
      <>
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="w-full h-12 rounded-xl" />
        ))}
      </>
    );
  }

  return (
    <div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 基本信息 */}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">标题</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTitleItem}
                className="flex items-center gap-2 bg-transparent"
              >
                <Plus className="h-4 w-4" />
                添加
              </Button>
            </div>

            <div className="space-y-4">
              {fields.map((field, index) => (
                <Card key={field.id} className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 space-y-4">
                      <FormField
                        control={form.control}
                        name={`title.${index}.title`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>标题</FormLabel>
                            <FormControl>
                              <Input placeholder="请输入标题" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`title.${index}.lang`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>语言</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="选择语言" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="zh">中文</SelectItem>
                                <SelectItem value="en">English</SelectItem>
                                <SelectItem value="ja">日本語</SelectItem>
                                <SelectItem value="ko">한국어</SelectItem>
                                <SelectItem value="fr">Français</SelectItem>
                                <SelectItem value="de">Deutsch</SelectItem>
                                <SelectItem value="es">Español</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeAlistItem(index)}
                        className="mt-8 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="alias"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>别名</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="请输入姓名"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>描述</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="游戏简介描述（中文）"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            {/* 上传图片组件 */}
            <ImageUpComp datas={data} />

            {form.formState.errors.title && (
              <p className="text-sm text-red-500">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          {/* 提交按钮 */}
          <div className="flex gap-4">
            <Button type="submit" className="flex-1">
              提交表单
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
              className="flex-1"
            >
              重置表单
            </Button>
          </div>

          {/* 调试信息 */}
          <div className="mt-6 p-4 rounded-lg">
            <Label className="text-sm font-medium">表单数据预览：</Label>
            <pre className="mt-2 text-xs overflow-auto">
              {JSON.stringify(form.watch(), null, 2)}
            </pre>
          </div>
        </form>
      </Form>
    </div>
  );
}
