import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useSelector } from '@tanstack/react-store'
import MDEditor from '@uiw/react-md-editor'
import { Button } from '@web/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@web/components/ui/dialog'
import { Field, FieldError, FieldGroup } from '@web/components/ui/field'
import { Input } from '@web/components/ui/input'
import { elysiaErrorF } from '@web/lib'
import { authClient } from '@web/server/auth/auth-client'
import {
  createIntroduction,
  updateIntroduction,
} from '@web/server/introduction'
import {
  introductionEditActions,
  introductionEditStore,
} from '@web/stores/introductionStores'
import { useTheme } from 'next-themes'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import z from 'zod'

// ── MDEditor 样式 ─────────────────────────────────────────────
import '@uiw/react-md-editor/markdown-editor.css'

// ── Props 接口（支持受控 / store 双模式） ──────────────────────────
interface CreateEditDialogProps {
  /** 游戏 ID，覆写 store 中的值 */
  gameId?: string
  /** 外部控制 open 状态 */
  open?: boolean
  /** open 状态变更回调 */
  onOpenChange?: (open: boolean) => void
  /** 编辑模式 */
  mode?: 'create' | 'edit'
  /** 初始数据 */
  initialData?: {
    id: string
    title: string
    content: string
    copyright: string
  }
  /** 操作成功回调 */
  onSuccess?: () => void
}

export function CreateEditDialog(props?: CreateEditDialogProps) {
  const router = useRouter()
  const formId = 'CreateEdit'
  const { resolvedTheme } = useTheme()

  // ── 优先使用 props，否则 fallback 到 store ──────────────────
  const storeData = useSelector(introductionEditStore, (s) => s.data)
  const storeOpen = useSelector(introductionEditStore, (s) => s.open)

  const isControlled = props?.open !== undefined
  const open = isControlled ? props.open! : storeOpen
  const mergedData = props?.initialData ?? storeData
  const isEdit = !!(props?.initialData?.id ?? mergedData?.id)

  // ── 获取用户 session ─────────────────────────────────────────
  const { data: session } = useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      const { data: res, error } = await authClient.getSession()
      elysiaErrorF(error)
      return res
    },
    enabled: open,
  })

  const isAdmin = session?.user?.role === 'admin'

  // ── Mutations ────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: createIntroduction,
    onSuccess: () => {
      toast.success(
        isAdmin ? '文章创建成功～' : '已提交审核，请等待管理员审核喵～',
      )
      router.invalidate({
        filter: (match) => match.routeId === '/$id/_layout/introduction/',
      })
      introductionEditActions.close()
      props?.onSuccess?.()
    },
    onError: (error: any) => {
      if (error?.status === 403) {
        toast.error(
          '权限不足，仅管理员可直接创建文章。您的提交已记录，请等待审核喵～',
        )
      } else {
        toast.error(error?.message || '创建失败，请稍后重试')
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: updateIntroduction,
    onSuccess: () => {
      toast.success('文章更新成功～')
      router.invalidate({
        filter: (match) => match.routeId === '/$id/_layout/introduction/',
      })
      introductionEditActions.close()
      props?.onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error?.message || '更新失败，请稍后重试')
    },
  })

  // ── 校验 Schema ──────────────────────────────────────────────
  const introductionFormSchema = z.object({
    title: z.string().min(1, '需要一个标题喵'),
    content: z.string().min(1, '内容是空的喵？'),
    copyright: z.string(),
    userid: z.string(),
  })

  // ── Form ─────────────────────────────────────────────────────
  const form = useForm({
    defaultValues: {
      title: mergedData?.title || '',
      content: mergedData?.content || '',
      copyright: mergedData?.copyright || '',
      userid: session?.user?.id ?? '',
    },
    validators: {
      onChange: introductionFormSchema,
      onSubmit: introductionFormSchema,
    },
    onSubmit: async ({ value }) => {
      if (!session?.user?.id) {
        toast.error('请先登录喵～')
        return
      }
      const gameId = props?.gameId ?? mergedData?.gameId ?? ''

      if (mergedData?.id) {
        await updateMutation.mutateAsync({
          data: {
            id: String(mergedData?.id),
            data: {
              title: value.title.trim(),
              content: value.content.trim(),
              copyright: value.copyright?.trim() || null,
            },
          },
        })
        return
      }
      if (!gameId) {
        toast.error('缺少游戏 ID，无法创建喵～')
        return
      }
      await createMutation.mutateAsync({
        data: {
          gameId,
          title: value.title.trim(),
          content: value.content.trim(),
          copyright: value.copyright?.trim() || null,
          userid: value.userid,
        },
      })
      form.reset()
    },
  })

  // ── 当 mergedData / session 变化时更新表单 ───────────────────
  const prevSnapshotRef = useRef('')
  useEffect(() => {
    const snapshot = JSON.stringify([
      mergedData?.id,
      mergedData?.gameId,
      mergedData?.title,
      mergedData?.content,
      mergedData?.copyright,
      props?.gameId,
      session?.user?.id,
    ])
    if (snapshot !== prevSnapshotRef.current) {
      prevSnapshotRef.current = snapshot
      form.reset({
        title: mergedData?.title || '',
        content: mergedData?.content || '',
        copyright: mergedData?.copyright || '',
        userid: session?.user?.id ?? '',
      })
    }
  }, [mergedData, session?.user?.id, props?.gameId])

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={introductionEditActions.onOpen}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? isAdmin
                ? '编辑文章'
                : '编辑攻略文章'
              : isAdmin
                ? '创建文章'
                : '提交攻略文章'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? '修改已有的攻略文章内容喵～'
              : isAdmin
                ? '创建一篇新的攻略文章'
                : '提交攻略文章供管理员审核'}
          </DialogDescription>
        </DialogHeader>

        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault()
            const errors = form.state.errors
            if (errors.length > 0) {
              console.log('form validation errors:', errors)
            }
            form.handleSubmit()
          }}
        >
          <FieldGroup className="gap-3">
            {/* ── 标题 ── */}
            <form.Field name="title">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <Input
                      className="text-sm"
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      aria-invalid={isInvalid}
                      onChange={(e) => field.handleChange(e.target.value)}
                      autoComplete="off"
                      placeholder="输入文章标题喵～"
                    />
                    {isInvalid && (
                      <FieldError
                        className="text-xs"
                        errors={field.state.meta.errors}
                      />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            {/* ── 内容 — 富文本 Markdown 编辑器 ── */}
            <form.Field name="content">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <div
                      data-color-mode={
                        resolvedTheme === 'dark' ? 'dark' : 'light'
                      }
                      className="w-full rounded-md border border-input overflow-hidden"
                    >
                      <MDEditor
                        value={field.state.value}
                        onChange={(val) => field.handleChange(val ?? '')}
                        preview="live"
                        height={400}
                        minHeight={250}
                        visibleDragbar={false}
                        textareaProps={{
                          placeholder: '输入文章喵～ 支持 Markdown 语法',
                          'aria-invalid': isInvalid,
                        }}
                      />
                    </div>
                    {isInvalid && (
                      <FieldError
                        className="text-xs"
                        errors={field.state.meta.errors}
                      />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            {/* ── 来源 ── */}
            <form.Field name="copyright">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <Input
                      className="text-sm"
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      aria-invalid={isInvalid}
                      onChange={(e) => field.handleChange(e.target.value)}
                      autoComplete="off"
                      placeholder="输入文章来源，如果有的话喵～"
                    />
                    {isInvalid && (
                      <FieldError
                        className="text-xs"
                        errors={field.state.meta.errors}
                      />
                    )}
                  </Field>
                )
              }}
            </form.Field>
          </FieldGroup>

          <DialogFooter className="mt-4">
            <Button
              form={formId}
              variant="outline"
              type="button"
              onClick={() => introductionEditActions.close()}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button form={formId} type="submit" disabled={isSubmitting}>
              {isSubmitting ? '提交中...' : isEdit ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
