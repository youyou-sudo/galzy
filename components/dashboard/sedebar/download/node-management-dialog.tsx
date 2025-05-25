"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/animate-ui/radix/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { configFormPut } from "@/lib/dashboard/download/configForm";

const formSchema = z.object({
  id: z.string().optional(),
  a_email: z.string().email().min(1, {
    message: "请输入邮箱",
  }),
  a_key: z.string().min(1, {
    message: "请输入 API 密钥",
  }),
  account_id: z.string().min(1, {
    message: "请输入帐户 ID",
  }),
  woker_name: z.string().min(1, {
    message: "请输入 woker 名称",
  }),
  url_endpoint: z.string().url(),
});

export function NodeManagementDialog({ refetch }: { refetch: () => void }) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: "",
      a_email: "",
      a_key: "",
      account_id: "",
      woker_name: "",
      url_endpoint: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsPending(true);
    try {
      await configFormPut({ ...values });
      setOpen(false);
      form.reset();
      refetch();
    } catch (error) {
      console.error("提交失败：", error);
    } finally {
      setIsPending(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          添加节点
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>添加新节点</DialogTitle>
          <DialogDescription>cloudflare Worker</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="a_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>邮箱</FormLabel>
                  <FormControl>
                    <Input placeholder="auth_email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="a_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API 密钥</FormLabel>
                  <FormControl>
                    <Input placeholder="auth_key" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="id"
              render={({ field }) => (
                <FormItem className="hidden">
                  <FormLabel> ID</FormLabel>
                  <FormControl>
                    <Input placeholder="account_id" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="account_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>帐户 ID</FormLabel>
                  <FormControl>
                    <Input placeholder="account_id" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="woker_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>woker 名称</FormLabel>
                  <FormControl>
                    <Input placeholder="woker_name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="url_endpoint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>域名路由</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button disabled={isPending} type="submit">
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {!isPending && <Plus className="mr-2 h-4 w-4" />}
                添加节点
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
