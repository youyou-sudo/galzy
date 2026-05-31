import { useForm } from '@tanstack/react-form'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@web/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from '@web/components/ui/field'
import { Input } from '@web/components/ui/input'
import { InputGroup, InputGroupInput } from '@web/components/ui/input-group'
import { authClient } from '@web/server/auth/auth-client'
import { Eye, EyeOff, Loader2, LogIn, Mail, User } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

const signupSchema = z
  .object({
    name: z.string().min(1, '请输入用户名'),
    email: z.string().min(1, '请输入邮箱地址').email('请输入有效的邮箱地址'),
    password: z.string().min(6, '密码至少需要6个字符'),
    confirmPassword: z.string().min(1, '请确认密码'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  })

export const Route = createFileRoute('/auth/signup')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const form = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    validators: {
      onChange: signupSchema,
    },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.signUp.email({
        name: value.name,
        email: value.email,
        password: value.password,
      })

      if (error) {
        toast.error(error.message || '注册失败，请重试')
        return
      }

      toast.success('注册成功，即将跳转...')
      // navigate({ to: '/' })
    },
  })

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">注册</CardTitle>
          <CardDescription>创建一个新账户</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void form.handleSubmit()
            }}
            className="flex flex-col gap-4"
          >
            <form.Field name="name">
              {(field) => (
                <Field orientation="vertical">
                  <FieldLabel>
                    <FieldTitle className="flex items-center gap-1.5">
                      <User className="size-3.5" />
                      用户名
                    </FieldTitle>
                  </FieldLabel>
                  <FieldContent>
                    <Input
                      type="text"
                      placeholder="您的用户名"
                      autoComplete="name"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      aria-invalid={
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0
                      }
                    />
                    <FieldDescription>设置您的显示名称</FieldDescription>
                    <FieldError errors={field.state.meta.errors} />
                  </FieldContent>
                </Field>
              )}
            </form.Field>

            <form.Field name="email">
              {(field) => (
                <Field orientation="vertical">
                  <FieldLabel>
                    <FieldTitle className="flex items-center gap-1.5">
                      <Mail className="size-3.5" />
                      邮箱
                    </FieldTitle>
                  </FieldLabel>
                  <FieldContent>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      autoComplete="email"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      aria-invalid={
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0
                      }
                    />
                    <FieldDescription>用于登录和接收通知</FieldDescription>
                    <FieldError errors={field.state.meta.errors} />
                  </FieldContent>
                </Field>
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <Field orientation="vertical">
                  <FieldLabel>
                    <FieldTitle className="flex items-center gap-1.5">
                      <LogIn className="size-3.5" />
                      密码
                    </FieldTitle>
                  </FieldLabel>
                  <FieldContent>
                    <InputGroup>
                      <InputGroupInput
                        type={showPassword ? 'text' : 'password'}
                        placeholder="至少6个字符"
                        autoComplete="new-password"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        aria-invalid={
                          field.state.meta.isTouched &&
                          field.state.meta.errors.length > 0
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? '隐藏密码' : '显示密码'}
                      >
                        {showPassword ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </Button>
                    </InputGroup>
                    <FieldDescription>至少6个字符</FieldDescription>
                    <FieldError errors={field.state.meta.errors} />
                  </FieldContent>
                </Field>
              )}
            </form.Field>

            <form.Field name="confirmPassword">
              {(field) => (
                <Field orientation="vertical">
                  <FieldLabel>
                    <FieldTitle className="flex items-center gap-1.5">
                      <LogIn className="size-3.5" />
                      确认密码
                    </FieldTitle>
                  </FieldLabel>
                  <FieldContent>
                    <InputGroup>
                      <InputGroupInput
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="再次输入密码"
                        autoComplete="new-password"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        aria-invalid={
                          field.state.meta.isTouched &&
                          field.state.meta.errors.length > 0
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        aria-label={
                          showConfirmPassword ? '隐藏密码' : '显示密码'
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </Button>
                    </InputGroup>
                    <FieldDescription>请再次输入密码以确认</FieldDescription>
                    <FieldError errors={field.state.meta.errors} />
                  </FieldContent>
                </Field>
              )}
            </form.Field>

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      注册中...
                    </>
                  ) : (
                    '注册'
                  )}
                </Button>
              )}
            </form.Subscribe>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            已有账户？{' '}
            <Link
              to="/auth/login"
              className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
            >
              去登录
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
