import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useSelector } from '@tanstack/react-store'
import { Image } from '@unpic/react'
import { Field, FieldError, FieldGroup } from '@web/components/ui/field'
import { elysiaErrorF } from '@web/lib'
import { authClient } from '@web/server/auth/auth-client'
import { createCmments } from '@web/server/comments'
import { replyCardStore, replycardActions } from '@web/stores/reply-edit-input'
import { PawPrint } from 'lucide-react'
import { useRef } from 'react'
import { toast } from 'sonner'
import * as z from 'zod'
import KaomojiPicker from '../EmojiPicker/emoji-picker'
import { Button } from '../ui/button'
import { Spinner } from '../ui/spinner'
import { Textarea } from '../ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group'

const items = [
  { label: '讨论', value: 'comment' },
  { label: '提问', value: 'question' },
  { label: '反馈', value: 'feedback' },
]

const formSchema = z.object({
  comments: z
    .string()
    .min(1, '说点什么喵～')
    .max(2000, '2000 字作文喵喵记不住喵'),
  type: z.enum(items.map((i) => i.value) as [string, ...string[]]),
})

export const ReplyEidtInput = ({
  reId,
  targetType,
  targetId,
  commentscomp,
}: {
  reId?: string
  targetType: string
  targetId: string
  commentscomp: boolean
}) => {
  const formId = `reply-edit-form-${reId}-${targetId}`
  const cursorPosRef = useRef({ start: 0, end: 0 })

  const data = useSelector(replyCardStore, (s) => s.data)
  const openReId = useSelector(replyCardStore, (s) => s.openReId)

  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: createCmments,
    onError: () => {
      toast.error(`评论失败喵～`)
    },
    onSuccess: () => {
      toast.success(`评论成功喵～`)
      queryClient.invalidateQueries({
        queryKey: ['comments', targetType, targetId],
      })
      replycardActions.close()
      form.reset()
    },
  })

  const form = useForm({
    defaultValues: {
      comments: '',
      type: items[0].value,
    },
    validators: {
      onChange: formSchema,
    },
    onSubmit: async ({ value }) => {
      mutation.mutate({
        data: {
          type: value.type,
          targetType: targetType,
          targetId: targetId,
          content: value.comments,
          parentId: reId,
          replyToUserId: data?.userId ?? undefined,
        },
      })
    },
  })

  const { data: session, isPending } = useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      const { data: res, error } = await authClient.getSession()
      elysiaErrorF(error)
      return res
    },
  })

  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  if (isPending && !reId)
    return (
      <div className="flex flex-col justify-center items-center">加载中……</div>
    )

  if (!session && !reId)
    return (
      <div className="flex flex-col justify-center items-center space-y-2">
        <Image
          className="rounded-sm"
          src="/neko.webp"
          width={100}
          height={100}
          alt="喵喵喵～这个图片用于提示用户未登陆"
        />
        <span className="opacity-50">登陆以评论喵～</span>
        <div className="space-x-2">
          <Button
            variant="outline"
            onClick={() => {
              navigate({
                to: '/auth/login',
                search: {
                  return_to: pathname,
                },
              })
            }}
          >
            登陆
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              navigate({
                to: '/auth/signup',
                search: {
                  return_to: pathname,
                },
              })
            }}
          >
            注册
          </Button>
        </div>
      </div>
    )

  if ((openReId && reId === openReId) || commentscomp)
    return (
      <div>
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          <FieldGroup className="gap-1">
            <form.Field name="comments">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  // 评论内容
                  <Field data-invalid={isInvalid}>
                    <Textarea
                      className="max-h-100 text-xs"
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={(e) => {
                        cursorPosRef.current = {
                          start: e.currentTarget.selectionStart ?? 0,
                          end: e.currentTarget.selectionEnd ?? 0,
                        }
                        field.handleBlur()
                      }}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      autoComplete="off"
                      placeholder={
                        commentscomp ? '简单喵两句～' : `回复@${data?.userName}`
                      }
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
            <form.Field name="type">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <div>
                    <Field orientation="horizontal" className="justify-between">
                      <div className="flex items-center">
                        <KaomojiPicker
                          onKaomojiSelect={(emoji) => {
                            const { start, end } = cursorPosRef.current
                            const currentValue = form.getFieldValue('comments')
                            const newValue =
                              currentValue.slice(0, start) +
                              ` ${emoji} ` +
                              currentValue.slice(end)
                            form.setFieldValue('comments', newValue)
                            // 恢复光标位置到插入内容之后
                            requestAnimationFrame(() => {
                              const textarea = document.getElementById(
                                'comments',
                              ) as HTMLTextAreaElement | null
                              if (textarea) {
                                const newCursorPos = start + emoji.length + 2
                                textarea.setSelectionRange(
                                  newCursorPos,
                                  newCursorPos,
                                )
                                textarea.focus()
                              }
                            })
                          }}
                          trigger={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="h-10 w-10 shrink-0"
                            >
                              <PawPrint />
                            </Button>
                          }
                        />
                      </div>
                      {/*评论类型*/}
                      {!reId && (
                        <Field data-invalid={isInvalid}>
                          <ToggleGroup
                            type="single"
                            size="sm"
                            id={field.name}
                            value={field.state.value}
                            variant="outline"
                            spacing={2}
                            onValueChange={(value) => {
                              if (value) field.handleChange(value)
                            }}
                          >
                            {items.map((item) => (
                              <ToggleGroupItem
                                key={item.value}
                                value={item.value}
                                name={field.name}
                                aria-label={`${item.label}`}
                                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground text-xs"
                              >
                                {item.label}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>

                          {isInvalid && (
                            <FieldError
                              className="text-xs"
                              errors={field.state.meta.errors}
                            />
                          )}
                        </Field>
                      )}
                      <Button
                        type="submit"
                        form={formId}
                        variant="outline"
                        className="text-xs"
                        disabled={mutation.isPending}
                      >
                        {mutation.isPending ? (
                          <Spinner data-icon="inline-start" />
                        ) : null}
                        发送
                      </Button>
                    </Field>
                  </div>
                )
              }}
            </form.Field>
          </FieldGroup>
        </form>
      </div>
    )
}
