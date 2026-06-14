import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { Avatar, AvatarFallback, AvatarImage } from '@web/components/ui/avatar'
import { Button } from '@web/components/ui/button'
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
import ProfileTab from '@web/components/user/ProfileMenu/ProfileTab'
import SecurityTab from '@web/components/user/ProfileMenu/SecurityTab'
import { elysiaErrorF } from '@web/lib'
import { getSession, listAccounts } from '@web/server/auth/auth.functions'
import { authClient } from '@web/server/auth/auth-client'
import { Mail, Pencil, Shield, User } from 'lucide-react'

export const Route = createFileRoute('/user/')({
  component: RouteComponent,
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
  const { data: clientSession, refetch: refetchSession } =
    authClient.useSession()
  const user = clientSession?.user ?? session.user

  if (!user) return null

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 用户头部信息 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <Avatar size="lg" className="size-20">
              <AvatarImage
                src={user.image ?? undefined}
                alt={user.name ?? ''}
              />
              <AvatarFallback className="text-2xl">
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-xl font-semibold">{user.name}</h2>
              <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1 mt-1">
                <Mail className="size-4" />
                {user.email}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/user/editor">
                <Pencil className="size-4" />
                编辑资料
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 标签页：个人资料 & 安全 */}
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
