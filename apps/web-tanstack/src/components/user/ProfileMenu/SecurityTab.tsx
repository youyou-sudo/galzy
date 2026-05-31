import { useForm } from '@tanstack/react-form'
import { Button } from '@web/components/ui/button'
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
  FieldTitle,
} from '@web/components/ui/field'
import { InputGroup, InputGroupInput } from '@web/components/ui/input-group'
import { authClient } from '@web/server/auth/auth-client'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, '请输入当前密码'),
    newPassword: z.string().min(8, '新密码长度至少为8个字符'),
    confirmPassword: z.string().min(1, '请确认新密码'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: '两次输入的新密码不一致',
    path: ['confirmPassword'],
  })

export default function SecurityTab() {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const form = useForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validators: {
      onChange: passwordSchema,
    },
    onSubmit: async ({ value }) => {
      await authClient.changePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
      })
      toast.success('密码修改成功')
      form.reset()
    },
  })

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-3">
        <div>
          <h4 className="text-sm font-medium">修改密码</h4>
          <p className="text-xs text-muted-foreground mt-1">
            更新密码以保障您的账户安全喵。
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
          className="flex flex-col gap-3"
        >
          <form.Field name="currentPassword">
            {(field) => (
              <Field orientation="vertical">
                <FieldLabel>
                  <FieldTitle>当前密码</FieldTitle>
                </FieldLabel>
                <FieldContent>
                  <InputGroup>
                    <InputGroupInput
                      type={showCurrentPassword ? 'text' : 'password'}
                      placeholder="请输入当前密码"
                      autoComplete="current-password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() =>
                        setShowCurrentPassword(!showCurrentPassword)
                      }
                      aria-label={showCurrentPassword ? '隐藏密码' : '显示密码'}
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </Button>
                  </InputGroup>
                  <FieldError errors={field.state.meta.errors} />
                </FieldContent>
              </Field>
            )}
          </form.Field>

          <form.Field name="newPassword">
            {(field) => (
              <Field orientation="vertical">
                <FieldLabel>
                  <FieldTitle>新密码</FieldTitle>
                </FieldLabel>
                <FieldContent>
                  <InputGroup>
                    <InputGroupInput
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="请输入新密码"
                      autoComplete="new-password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      aria-label={showNewPassword ? '隐藏密码' : '显示密码'}
                    >
                      {showNewPassword ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </Button>
                  </InputGroup>
                  <FieldError errors={field.state.meta.errors} />
                </FieldContent>
              </Field>
            )}
          </form.Field>

          <form.Field name="confirmPassword">
            {(field) => (
              <Field orientation="vertical">
                <FieldLabel>
                  <FieldTitle>确认密码</FieldTitle>
                </FieldLabel>
                <FieldContent>
                  <InputGroup>
                    <InputGroupInput
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="请确认新密码"
                      autoComplete="new-password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      aria-label={showConfirmPassword ? '隐藏密码' : '显示密码'}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </Button>
                  </InputGroup>
                  <FieldError errors={field.state.meta.errors} />
                </FieldContent>
              </Field>
            )}
          </form.Field>

          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button
                type="submit"
                className="w-full"
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    修改中...
                  </>
                ) : (
                  '修改密码'
                )}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </div>
    </div>
  )
}
