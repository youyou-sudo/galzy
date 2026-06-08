import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
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
import { seedVerification } from '@web/server/auth/auth.functions'
import { authClient } from '@web/server/auth/auth-client'
import { RefreshCwIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import z from 'zod'

export const validateSearchSchema = z.object({
  email: z.email(),
  return_to: z.optional(z.string()),
})

export const Route = createFileRoute('/auth/signup/Verification')({
  component: RouteComponent,
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
            toast.success('验证成功，正在跳转')
            navigate({ to: return_to || '/auth/login' })
          },
          onError: (ctx) => {
            toast.error(ctx.error.message)
          },
        },
      })
    },
  })

  if (seedS?.error) {
    toast.error(seedS.error.message)
  }

  return (
    <div className="flex justify-center">
      <Card className="felx w-85">
        <CardHeader>
          <CardTitle>验证您的邮箱喵～</CardTitle>
          <CardDescription>
            输入发送到邮箱的验证码：
            <span className="font-medium">{email}</span>
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="otp-verification">验证码</FieldLabel>

              <Button
                variant="outline"
                size="xs"
                onClick={async () => {
                  await authClient.emailopt.seedverificationemail({
                    email: email,
                    type: 'email-verification',
                    fetchOptions: {
                      onSuccess: () => {
                        toast.success('验证码已发送')
                      },
                      onError: (ctx) => {
                        toast.error(ctx.error.message)
                      },
                    },
                  })
                }}
              >
                <RefreshCwIcon />
                重新发送验证码
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
              <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:w-11 *:data-[slot=input-otp-slot]:text-xl">
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>

              <InputOTPSeparator className="mx-2" />

              <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:w-11 *:data-[slot=input-otp-slot]:text-xl">
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </Field>
        </CardContent>

        <CardFooter>
          <Field>
            <Button
              type="submit"
              className="w-full"
              disabled={verify.isPending}
              onClick={() => verify.mutate()}
            >
              {verify.isPending && <RefreshCwIcon className="animate-spin" />}
              Verify
            </Button>
          </Field>
        </CardFooter>
      </Card>
    </div>
  )
}
