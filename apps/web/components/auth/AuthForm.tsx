'use client'

import { useRouter } from '@bprogress/next/app'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
} from '@web/components/animate-ui/radix/tabs'
import { Alert, AlertDescription, AlertTitle } from '@web/components/ui/alert'
import { Button } from '@web/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@web/components/ui/form'
import { Input } from '@web/components/ui/input'
import { authClient } from '@web/lib/auth/auth-client'
import { AlertCircle, EyeIcon, EyeOffIcon, Loader2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const signInformSchema = z.object({
  email: z.string().email({
    message: '请输入正确邮箱',
  }),
  password: z.string().min(8, {
    message: '密码至少8个字符',
  }),
})

const signUpformSchema = z.object({
  name: z.string().min(1, {
    message: '请输入用户名',
  }),
  email: z.string().email({
    message: '请输入正确邮箱',
  }),
  password: z.string().min(8, {
    message: '密码至少8个字符',
  }),
})
export default function AuthForm() {
  const [isVisible, setIsVisible] = useState<boolean>(false)
  const toggleVisibility = () => setIsVisible((prevState) => !prevState)
  const [tabsValue, setTabsValue] = useState<string>('account')
  const [pending, setPending] = useState(false)
  type AuthResponse = { user?: { email?: string }; message?: string } | null
  const [signInstare, setSignInStare] = useState<AuthResponse>(null)
  const [signUpstare, setSignUpStare] = useState<AuthResponse>(null)

  const searchParams = useSearchParams()
  const router = useRouter()

  const signInform = useForm<z.infer<typeof signInformSchema>>({
    resolver: zodResolver(signInformSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })
  const signUpform = useForm<z.infer<typeof signUpformSchema>>({
    resolver: zodResolver(signUpformSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  })

  async function signInAc(values: z.infer<typeof signInformSchema>) {
    setPending(true)
    const { data, error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    })
    setPending(false)
    if (error) {
      setSignInStare(error)
    }
    if (error === null && data) {
      setSignInStare(data)
    }
  }
  async function signUpAc(values: z.infer<typeof signUpformSchema>) {
    setPending(true)
    const { data, error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
    })
    setPending(false)
    if (error) {
      setSignUpStare(error)
    }
    if (error === null) {
      setSignUpStare(data)
    }
  }

  const { data: session } = authClient.useSession()

  const redirect = searchParams.get('from') || '/'
  useEffect(() => {
    if (session?.user) {
      router.push(redirect)
    }
  }, [session, redirect, router])

  return (
    <div className="flex flex-col justify-center items-center">
      <Tabs
        value={tabsValue}
        onValueChange={setTabsValue}
        defaultValue="account"
        className="w-[400px] bg-muted rounded-lg"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="account">登录</TabsTrigger>
          <TabsTrigger value="password">注册</TabsTrigger>
        </TabsList>

        <TabsContents className="mx-1 mb-1 -mt-2 rounded-sm h-full bg-background">
          <TabsContent value="account" className="space-y-6 p-6">
            <Form {...signInform}>
              <form
                onSubmit={signInform.handleSubmit(signInAc)}
                className="space-y-3"
              >
                <FormField
                  control={signInform.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>邮箱</FormLabel>
                      <FormControl>
                        <Input placeholder="Emali" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signInform.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>密码</FormLabel>
                      <FormControl>
                        <div className="*:not-first:mt-2">
                          <div className="relative">
                            <Input
                              className="pe-9"
                              placeholder="Password"
                              type={isVisible ? 'text' : 'password'}
                              {...field}
                            />
                            <button
                              className="text-muted-foreground/80 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-none focus:z-10 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                              type="button"
                              onClick={toggleVisibility}
                              aria-label={
                                isVisible ? 'Hide password' : 'Show password'
                              }
                              aria-pressed={isVisible}
                              aria-controls="password"
                            >
                              {isVisible ? (
                                <EyeOffIcon size={16} aria-hidden="true" />
                              ) : (
                                <EyeIcon size={16} aria-hidden="true" />
                              )}
                            </button>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {signInstare !== null && (
                  <Alert
                    variant={signInstare!.user ? 'default' : 'destructive'}
                  >
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>
                      {signInstare.user ? '登录成功' : '登录失败'}
                    </AlertTitle>
                    <AlertDescription>
                      {signInstare.user
                        ? signInstare.user.email
                        : signInstare.message}
                    </AlertDescription>
                  </Alert>
                )}
                <p className="text-sm text-muted-foreground">
                  还没有账户？
                  <button
                    className="text-sm text-blue-500 hover:text-blue-700 focus:outline-none focus: focus:ring-blue-500 focus:ring-opacity-50"
                    onClick={() => {
                      setTabsValue('password')
                    }}
                  >
                    注册
                  </button>
                </p>
                <Button disabled={pending} type="submit" className="w-full">
                  {pending === true && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  登录
                </Button>
              </form>
            </Form>
          </TabsContent>
          <TabsContent value="password" className="space-y-6 p-6">
            <Form {...signUpform}>
              <form
                onSubmit={signUpform.handleSubmit(signUpAc)}
                className="space-y-3"
              >
                <FormField
                  control={signUpform.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>用户名</FormLabel>
                      <FormControl>
                        <Input placeholder="Name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signUpform.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>邮箱</FormLabel>
                      <FormControl>
                        <Input placeholder="Emali" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signUpform.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>密码</FormLabel>
                      <FormControl>
                        <div className="*:not-first:mt-2">
                          <div className="relative">
                            <Input
                              className="pe-9"
                              placeholder="Password"
                              type={isVisible ? 'text' : 'password'}
                              {...field}
                            />
                            <button
                              className="text-muted-foreground/80 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-none focus:z-10 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                              type="button"
                              onClick={toggleVisibility}
                              aria-label={
                                isVisible ? 'Hide password' : 'Show password'
                              }
                              aria-pressed={isVisible}
                              aria-controls="password"
                            >
                              {isVisible ? (
                                <EyeOffIcon size={16} aria-hidden="true" />
                              ) : (
                                <EyeIcon size={16} aria-hidden="true" />
                              )}
                            </button>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {signUpstare !== null && (
                  <Alert variant={signUpstare.user ? 'default' : 'destructive'}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>
                      {signUpstare.user ? '注册成功' : '注册失败'}
                    </AlertTitle>
                    <AlertDescription>
                      {signUpstare.user
                        ? signUpstare.user.email
                        : signUpstare.message}
                    </AlertDescription>
                  </Alert>
                )}
                <p className="text-sm text-muted-foreground">
                  已有账户？
                  <button
                    className="text-sm text-blue-500 hover:text-blue-700 focus:outline-none focus: focus:ring-blue-500 focus:ring-opacity-50"
                    onClick={() => {
                      setTabsValue('account')
                    }}
                  >
                    登录
                  </button>
                </p>

                <Button disabled={pending} type="submit" className="w-full">
                  {pending === true && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  注册
                </Button>
              </form>
            </Form>
          </TabsContent>
        </TabsContents>
      </Tabs>
    </div>
  )
}
