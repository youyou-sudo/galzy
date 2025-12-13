'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@shadcn/ui/components/button'
import { Card } from '@shadcn/ui/components/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@shadcn/ui/components/form'
import { Input } from '@shadcn/ui/components/input'
import { Label } from '@shadcn/ui/components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@shadcn/ui/components/select'
import { Skeleton } from '@shadcn/ui/components/skeleton'
import { Textarea } from '@shadcn/ui/components/textarea'
import { QueryClient, useMutation, useQueryClient } from '@tanstack/react-query'
import { vidassociationUpdate } from '@web/lib/dashboard/dataManagement/dataGet'
import { Loader2Icon, Plus, Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import * as z from 'zod'
import { useFilterStore, usePaginationStore } from '../stores/dataManagement'
import { useEditDialog } from '../stores/useEditDialog'

// 定义表单验证模式
const formSchema = z.object({
  title: z.array(
    z.object({
      title: z.string({
        message: '标题需为字符串',
      }),
      lang: z.string({
        message: '请选择语言',
      }),
    }),
  ),
  alias: z.string().optional().nullable(),
  description: z.string({
    message: '非法描述',
  }),
})

type FormValues = z.infer<typeof formSchema>

export default function EditComponent() {
  const { data } = useEditDialog()
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: data?.title || [{ title: '', lang: '' }],
      description: data?.description || '',
      alias: data?.alias || '',
    },
  })
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'title',
  })

  const queryClient = new QueryClient()
  const queryClientc = useQueryClient()
  const { close } = useEditDialog()
  const { datapage, limit } = usePaginationStore()
  const filterNusq = useFilterStore((state) => state.filterNusq)

  const { mutate: onSubmit, isPending: delllLoading } = useMutation({
    mutationFn: async (values: FormValues) => {
      await vidassociationUpdate(Number(data!.id), values)
      queryClientc.invalidateQueries({
        queryKey: ['dataFilteringGet', filterNusq, datapage, limit],
      })
      close()
    },
    onSettled: () => queryClient.invalidateQueries(),
  })

  // / 中间函数，符合 handleSubmit 需要的签名
  const handleFormSubmit = (values: FormValues) => {
    onSubmit(values)
  }

  const addTitleItem = () => {
    append({ title: '', lang: '' })
  }

  const removeAlistItem = (index: number) => {
    if (fields.length > 1) {
      remove(index)
    }
  }
  useEffect(() => {
    if (data) {
      form.reset({
        title: data.title || [{ title: '', lang: '' }],
        description: data.description || '',
        alias: data.alias || '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])
  if (!data) {
    return (
      <>
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="w-full h-12 rounded-xl" />
        ))}
      </>
    )
  }
  return (
    <div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleFormSubmit)}
          className="space-y-6"
        >
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
                        <Textarea
                          placeholder="请输入alias，一行一个"
                          {...field}
                          value={field.value ?? ''}
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
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {form.formState.errors.title && (
              <p className="text-sm text-red-500">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          {/* 提交按钮 */}
          <div className="flex gap-4">
            <Button type="submit" className="flex-1">
              {delllLoading && <Loader2Icon className="animate-spin" />}
              提交数据
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
              className="flex-1"
            >
              清空数据
            </Button>
          </div>

          {/* 调试信息 */}
          {/* <div className="mt-6 p-4 rounded-lg">
            <Label className="text-sm font-medium">表单数据预览：</Label>
            <pre className="mt-2 text-xs overflow-auto">
              {JSON.stringify(form.watch(), null, 2)}
            </pre>
          </div> */}
        </form>
      </Form>
    </div>
  )
}
