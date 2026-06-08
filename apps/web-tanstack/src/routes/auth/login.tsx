import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
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
import { getSession } from '@web/server/auth/auth.functions'
import { authClient } from '@web/server/auth/auth-client'
import { Eye, EyeOff, Loader2, LogIn, Mail } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().min(1, '请输入邮箱地址').email('请输入有效的邮箱地址'),
  password: z.string().min(1, '请输入密码'),
})

export const ReturnToSchema = z.object({
  return_to: z.string().optional(),
})

export const Route = createFileRoute('/auth/login')({
  component: RouteComponent,
  validateSearch: ReturnToSchema,
  loaderDeps: ({ search: { return_to } }) => ({ return_to }),
  loader: async ({ deps: { return_to } }) => {
    const auth = await getSession()
    if (auth)
      return redirect({
        to: return_to || '/',
      })
  },
})

function RouteComponent() {
  const [showPassword, setShowPassword] = useState(false)
  const queryClient = useQueryClient()
  const { return_to } = Route.useSearch()
  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    validators: {
      onChange: loginSchema,
    },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email({
        email: value.email,
        password: value.password,
        callbackURL: return_to || '/',
        fetchOptions: {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: ['auth'],
            })
            toast.success('登录成功喵～')
          },
          onError: ({ error }) => {
            toast.error(error.message || '登录失败，请重试喵～')
          },
        },
      })
    },
  })

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">登录</CardTitle>
          <CardDescription>使用邮箱和密码登录您的账户</CardDescription>
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
                    <FieldDescription>请输入您的注册邮箱</FieldDescription>
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
                        placeholder="••••••••"
                        autoComplete="current-password"
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
                    <FieldDescription>请输入您的密码</FieldDescription>
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
                      登录中...
                    </>
                  ) : (
                    '登录'
                  )}
                </Button>
              )}
            </form.Subscribe>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            还没有账户？{' '}
            <Link
              to="/auth/signup"
              className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
            >
              去注册
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
