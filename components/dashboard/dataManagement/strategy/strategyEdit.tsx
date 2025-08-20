"use client";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect } from "react";

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/animate-ui/radix/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useLoginModalStore } from "./stores/EditStores";
import {
  strategyListCreate,
  strategyListUpdate,
} from "@/lib/strategy/strategyAc";
import { Loader2Icon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  title: z.string(),
  content: z.string(),
  copyright: z.string().url().or(z.literal("")),
});

export function StrategEdit() {
  const queryClient = useQueryClient();
  const { isOpen, data, create, toggleModal, closeModal } =
    useLoginModalStore();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      content: "",
      copyright: "",
    },
  });

  const { mutate: onSubmitAc, isPending: onSubmitAcLoading } = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      try {
        if (create) {
          await strategyListCreate(data.id!, values);
        } else {
          await strategyListUpdate(data.id!, values);
        }
        queryClient.invalidateQueries({
          queryKey: ["strategyList"],
        });
        await closeModal();
        form.reset({
          title: "",
          content: "",
          copyright: "",
        });
      } catch (e) {
        console.log(e);
      }
    },
  });

  useEffect(() => {
    if (data.data) {
      form.reset({
        title: data.data.title,
        content: data.data.content,
        copyright: data.data.copyright || "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    if (!isOpen) {
      form.reset({
        title: "",
        content: "",
        copyright: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  function onSubmit(values: z.infer<typeof formSchema>) {
    onSubmitAc(values);
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={toggleModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terms of Service</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>标题</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>文章标题</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>内容</FormLabel>
                    <FormControl>
                      <Textarea className="h-96" {...field} />
                    </FormControl>
                    <FormDescription>文章内容，支持 Markdown</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="copyright"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>转载链接（可选）</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      如果是转载文章请填写转载链接
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit">
                  {onSubmitAcLoading && (
                    <Loader2Icon className="animate-spin" />
                  )}
                  提交
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
