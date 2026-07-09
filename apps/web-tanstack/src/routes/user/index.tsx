import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@web/components/ui/tabs'
import AvatarComp from '@web/components/user/ProfileMenu/AvatarEditor'
import ProfileTab from '@web/components/user/ProfileMenu/ProfileTab'
import SecurityTab from '@web/components/user/ProfileMenu/SecurityTab'
import { elysiaErrorF } from '@web/lib'
import { getSession, listAccounts } from '@web/server/auth/auth.functions'
import { authClient } from '@web/server/auth/auth-client'
import { Mail, Shield, User } from 'lucide-react'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

const errorMessages: Record<string, string> = {
  "email_doesn't_match":
    '当前账户邮箱与第三方账户邮箱不一致，无法绑定。如需绑定不同邮箱的账户，请联系管理员喵～',
  account_already_linked_to_different_user:
    '该第三方账户已绑定到其他用户，无法重复绑定。',
  unable_to_link_account: '账户关联失败，请稍后重试。',
}

const UserSearchSchema = z.object({
  error: z.string().optional(),
  error_description: z.string().optional(),
})

export const Route = createFileRoute('/user/')({
  component: RouteComponent,
  validateSearch: UserSearchSchema,
  loader: async ({ context }) => {
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/auth/login' })
    }

    await context.queryClient.ensureQueryData({
      queryKey: ['linked-accounts'],
      queryFn: async () => {
        const { data, error } = await listAccounts()
        elysiaErrorF(error)
        return data ?? []
      },
    })

    return session
  },
})

function RouteComponent() {
  const session = Route.useLoaderData()
  const { error: errorCode, error_description: errorDescription } =
    Route.useSearch()
  const { data: clientSession, refetch: refetchSession } =
    authClient.useSession()
  const user = clientSession?.user ?? session.user

  useEffect(() => {
    if (errorCode) {
      const message =
        errorMessages[errorCode] ??
        errorDescription ??
        `账户关联时发生错误（${errorCode}），请稍后重试或联系管理员喵～`
      toast.error(message)
    }
  }, [errorCode, errorDescription])

  if (!user) return null

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 用户头部信息 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="flex flex-col items-center gap-1.5">
              <AvatarComp name={user.name} image={user.image} editor />
              <span className="text-xs text-muted-foreground/70 cursor-default select-none">
                点击更换头像
              </span>
            </div>
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <h2 className="text-xl font-semibold truncate">{user.name}</h2>
              <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1 mt-1">
                <Mail className="size-4 shrink-0" />
                <span className="truncate">{user.email}</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 标签页：个人资料 & 安全 & 账户 */}
      <Tabs defaultValue="profile">
        <TabsList variant="line" className="w-full">
          <TabsTrigger value="profile" className="flex-1">
            <User className="size-4" />
            个人资料
          </TabsTrigger>
          <TabsTrigger value="security" className="flex-1">
            <Shield className="size-4" />
            安全
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">个人资料</CardTitle>
            </CardHeader>
            <CardContent>
              <ProfileTab user={user} onProfileUpdated={refetchSession} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">安全设置</CardTitle>
            </CardHeader>
            <CardContent>
              <SecurityTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
