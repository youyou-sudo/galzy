import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { OauthButton } from '@web/components/auth/OauthButton'
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
import { seoMeta } from '@web/lib/seo'
import { getSession } from '@web/server/auth/auth.functions'
import { authClient } from '@web/server/auth/auth-client'
import { Eye, EyeOff, Loader2, LogIn, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { object, string } from 'zod/schemas'

const loginSchema = object({
  email: string().min(1, '请输入邮箱地址').email('请输入有效的邮箱地址'),
  password: string().min(1, '请输入密码'),
})

export const ReturnToSchema = object({
  return_to: string().optional(),
  error: string().optional(),
  error_description: string().optional(),
})

// Better Auth 的错误重定向携带机器码 `error`（如 access_denied / invalid_code）
// 与可选的人类可读 `error_description`。这里把机器码映射成中文提示，
// 有 description 时优先展示 description。
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: '您取消了第三方登录',
  invalid_code: '第三方登录授权码无效或已过期',
  state_mismatch: '登录状态校验失败，请重试',
  oauth_provider_not_found: '未找到对应的第三方登录服务',
  unable_to_get_user_info: '获取第三方账号信息失败',
  email_not_found: '第三方账号未返回邮箱，无法登录',
  email_doesn_t_match: '第三方账号邮箱与当前账号不一致',
  account_already_linked_to_different_user: '该第三方账号已绑定其他账号',
  unable_to_link_account: '第三方账号绑定失败',
  no_code: '未收到第三方登录授权码',
}

export const Route = createFileRoute('/auth/login')({
  component: RouteComponent,
  head: () =>
    seoMeta({
      title: '登录 | GalZY - Galgame 资源站',
      noindex: true,
    }),
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
  const { return_to, error, error_description } = Route.useSearch()

  // OAuth 登录失败后 Better Auth 携带 `?error=...&error_description=...`
  // 跳回此页。优先展示 description，否则把机器码映射成中文提示。
  useEffect(() => {
    if (error) {
      const description = error_description
        ? decodeURIComponent(error_description)
        : OAUTH_ERROR_MESSAGES[error]
          ? OAUTH_ERROR_MESSAGES[error]
          : error
      toast.error(description, { id: 'oauth-error' })
    }
  }, [error, error_description])

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
          <OauthButton />
        </CardContent>
      </Card>
    </div>
  )
}
