"use client";
import { Button } from '@web/components/ui/button';
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@web/components/animate-ui/radix/dialog';
import { useTagEditDialog } from './stort';
import { z } from "zod"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@web/components/ui/form"
import { Input } from "@web/components/ui/input"
import { useEffect } from 'react';
import { Checkbox } from '@web/components/ui/checkbox';
import { Textarea } from '@web/components/ui/textarea';
import { tagEditAction } from './(action)/action';
import { useMutation } from '@tanstack/react-query';

const formSchema = z.object({
  id: z.string(),
  zh_name: z.string(),
  zh_alias: z.string(),
  zh_description: z.string(),
  exhibition: z.boolean()
})
export const TagDialogEdit = () => {
  const { isOpen, close, data } = useTagEditDialog()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: "",
      zh_name: "",
      exhibition: false,
      zh_alias: "",
      zh_description: "",
    },
  })
  useEffect(() => {
    if (data) {
      form.setValue("id", data.id || "")
      form.setValue("zh_name", data.zh_name || "")
      form.setValue("exhibition", data.exhibition)
      form.setValue("zh_alias", data.zh_alias || "")
      form.setValue("zh_description", data.zh_description || "")
    }
  }, [data])
  const { mutate, isPending } = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const log = await tagEditAction(values)
      if (log === 200) {
        close()
      }
    },
  })
  // 2. Define a submit handler.
  function onSubmit(values: z.infer<typeof formSchema>) {
    mutate(values)
  }

  return (
    <Dialog open={isOpen} onOpenChange={close}>
      <DialogContent >
        <DialogHeader>
          <DialogTitle>{data?.zh_name}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="id"
              render={() => (
                <FormItem className='hidden'>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="zh_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>名称</FormLabel>
                  <FormControl>
                    <Input placeholder="名称" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="exhibition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>是否显示</FormLabel>
                  <FormControl>
                    <Checkbox onCheckedChange={field.onChange} checked={field.value} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="zh_alias"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>别名</FormLabel>
                  <FormControl>
                    <Input placeholder="别名" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="zh_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>简介</FormLabel>
                  <FormControl>
                    <Textarea placeholder="简介" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit"
              disabled={isPending}>
              提交
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
