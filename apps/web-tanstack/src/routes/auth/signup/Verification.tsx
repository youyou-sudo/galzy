import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { BrandMark } from '@web/components/auth/brand-mark'
import { Button } from '@web/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'
import { Field, FieldLabel } from '@web/components/ui/field'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@web/components/ui/input-otp'
import { seoMeta } from '@web/lib/seo'
import { seedVerification } from '@web/server/auth/auth.functions'
import { authClient } from '@web/server/auth/auth-client'
import { RefreshCwIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import * as z from 'zod/mini'

export const validateSearchSchema = z.object({
  email: z.email(),
  return_to: z.optional(z.string()),
})

export const Route = createFileRoute('/auth/signup/Verification')({
  component: RouteComponent,
  head: () =>
    seoMeta({
      title: '邮箱验证 | GalZY - Galgame 资源站',
      noindex: true,
    }),
  validateSearch: validateSearchSchema,
  loaderDeps: ({ search: { email } }) => ({ email }),
  loader: async ({ deps }) => {
    return {
      seedS: await seedVerification({ data: { email: deps.email } }),
    }
  },
  headers: () => ({
    'Cache-Control': 'no-cache',
  }),
})

function RouteComponent() {
  const { email, return_to } = Route.useSearch()
  const { seedS } = Route.useLoaderData()
  const [value, setValue] = useState('')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const seedVerificationEmail = useMutation({
    mutationFn: async () => {
      await authClient.emailopt.seedverificationemail({
        email: email,
        type: 'email-verification',
        fetchOptions: {
          onSuccess: () => {
            toast.success('验证码已发送喵～')
          },
          onError: (ctx) => {
            toast.error(ctx.error.message)
          },
        },
      })
    },
  })

  const verify = useMutation({
    mutationFn: async () => {
      await authClient.emailopt.emailverificationtop({
        email,
        otp: value,
        type: 'email-verification',
        fetchOptions: {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: ['auth'],
            })
            toast.success('验证成功，正在跳转喵～')
            navigate({ to: return_to || '/auth/login' })
          },
          onError: (ctx) => {
            toast.error(ctx.error.message)
          },
        },
      })
    },
  })

  useEffect(() => {
    if (seedS?.error) {
      toast.error(seedS.error.message)
    }
  }, [seedS?.error])

  return (
    <div className="mx-auto w-full max-w-md py-6">
      <Card className="w-full">
        <CardHeader className="items-center gap-2 text-center">
          <BrandMark />
          <CardTitle className="text-2xl font-semibold tracking-tight">
            验证邮箱
          </CardTitle>
          <CardDescription className="text-sm">
            验证码已发送到{' '}
            <span className="font-medium break-all text-foreground">
              {email}
            </span>
            ，没收到的话翻一下垃圾邮箱喵～
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          <Field>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel htmlFor="otp-verification">验证码</FieldLabel>
              <Button
                variant="outline"
                size="sm"
                disabled={seedVerificationEmail.isPending}
                onClick={() => seedVerificationEmail.mutate()}
              >
                <RefreshCwIcon
                  className={
                    seedVerificationEmail.isPending ? 'animate-spin' : undefined
                  }
                  aria-hidden="true"
                />
                重新发送
              </Button>
            </div>

            <InputOTP
              maxLength={6}
              id="otp-verification"
              required
              value={value}
              onChange={setValue}
              className="flex justify-center"
            >
              <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:w-10 *:data-[slot=input-otp-slot]:text-xl sm:*:data-[slot=input-otp-slot]:w-11">
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>

              <InputOTPSeparator className="mx-2" />

              <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:w-10 *:data-[slot=input-otp-slot]:text-xl sm:*:data-[slot=input-otp-slot]:w-11">
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </Field>
        </CardContent>

        <CardFooter className="flex-col items-stretch gap-3">
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={verify.isPending}
            onClick={() => verify.mutate()}
          >
            {verify.isPending && (
              <RefreshCwIcon className="animate-spin" aria-hidden="true" />
            )}
            验证
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            填错邮箱了？{' '}
            <Link
              to="/auth/signup"
              className="font-medium text-primary transition-colors hover:text-primary/80"
            >
              重新注册
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
