'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@shadcn/ui/components/animate-ui/components/radix/dialog'
import { Button } from '@shadcn/ui/components/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@shadcn/ui/components/form'
import { Input } from '@shadcn/ui/components/input'
import { configFormPut } from '@web/lib/dashboard/download/configForm'
import { Loader2, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { downloadStore } from './stores/download'

const formSchema = z.object({
  a_email: z.string().email('请输入有效邮箱').min(1, {
    message: '请输入邮箱',
  }),
  a_key: z.string().min(1, {
    message: '请输入 API 密钥',
  }),
  account_id: z.string().min(1, {
    message: '请输入帐户 ID',
  }),
  woker_name: z.string().min(1, {
    message: '请输入 woker 名称',
  }),
  url_endpoint: z.string().url({
    message: '请输入有效的 URL',
  }),
})

export function NodeManagementDialog({
  refetchAction,
}: {
  refetchAction: () => void
}) {
  const isOpen = downloadStore((s) => s.isOpen)
  const setOpen = downloadStore((s) => s.setOpen)
  const data = downloadStore((s) => s.data)
  const close = downloadStore((s) => s.close)

  const [isPending, setIsPending] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      a_email: '',
      a_key: '',
      account_id: '',
      woker_name: '',
      url_endpoint: '',
    },
  })

  // 在 data 更新时重置表单
  useEffect(() => {
    form.reset(
      {
        a_email: data?.a_email || '',
        a_key: data?.a_key || '',
        account_id: data?.account_id || '',
        woker_name: data?.woker_name || '',
        url_endpoint: data?.url_endpoint || '',
      },
      {
        keepDirtyValues: true,
      },
    )
  }, [data, form])

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsPending(true)
    try {
      await configFormPut({ ...values, id: data?.id })
      await setOpen(false)
      await form.reset()
      await refetchAction()
    } catch (error) {
      console.error('提交失败：', error)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>节点信息</DialogTitle>
          <DialogDescription>Cloudflare Worker 配置</DialogDescription>
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
                  <FormLabel>Worker 名称</FormLabel>
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
              <Button
                variant="outline"
                onClick={() => {
                  close()
                }}
                type="button"
              >
                取消
              </Button>
              <Button type="submit">
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                提交
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
