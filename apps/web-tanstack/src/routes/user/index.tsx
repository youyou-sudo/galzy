import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { TopicCard } from '@web/components/topics/topic-card'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'
import { Skeleton } from '@web/components/ui/skeleton'
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
import { seoMeta } from '@web/lib/seo'
import { getSession, listAccounts } from '@web/server/auth/auth.functions'
import { authClient } from '@web/server/auth/auth-client'
import { getUserFavorites, getUserLikes } from '@web/server/topics'
import { Bookmark, Heart, Mail, Shield, User } from 'lucide-react'
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
  tab: z
    .enum(['profile', 'security', 'favorites', 'likes'])
    .optional()
    .default('profile'),
  page: z.number().optional().default(1),
})

export const Route = createFileRoute('/user/')({
  head: () =>
    seoMeta({
      title: '个人中心 | GalZY - Galgame 资源站',
      noindex: true,
    }),
  validateSearch: UserSearchSchema,
  loaderDeps: ({ search: { page } }) => ({ page }),
  loader: async ({ context, deps: { page } }) => {
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/auth/login' })
    }

    await Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: ['linked-accounts'],
        queryFn: async () => {
          const { data, error } = await listAccounts()
          elysiaErrorF(error)
          return data ?? []
        },
      }),
      context.queryClient.ensureQueryData({
        queryKey: ['userFavorites', page],
        queryFn: async () =>
          await getUserFavorites({ data: { page, limit: 10 } }),
      }),
      context.queryClient.ensureQueryData({
        queryKey: ['userLikes', page],
        queryFn: async () => await getUserLikes({ data: { page, limit: 10 } }),
      }),
    ])

    return { session }
  },
  pendingComponent: () => <UserPageSkeleton />,
  staleTime: 30_000,
  gcTime: 5 * 60_000,
  headers: () => ({
    'Cache-Control': 'private, no-cache',
    Vary: 'Accept, Accept-Encoding',
  }),
  component: UserPage,
})

function UserPage() {
  const { session } = Route.useLoaderData()
  const {
    error: errorCode,
    error_description: errorDescription,
    tab,
    page,
  } = Route.useSearch()
  const navigate = Route.useNavigate()

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

  const { data: favData, isFetching: favLoading } = useQuery({
    queryKey: ['userFavorites', page],
    queryFn: async () => await getUserFavorites({ data: { page, limit: 10 } }),
  })

  const { data: likeData, isFetching: likeLoading } = useQuery({
    queryKey: ['userLikes', page],
    queryFn: async () => await getUserLikes({ data: { page, limit: 10 } }),
  })

  if (!user) return null

  return (
    <div className="max-w-3xl mx-auto space-y-6">
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

      {/* 标签页：个人资料 & 安全 & 收藏 & 喜欢 */}
      <Tabs
        value={tab}
        onValueChange={(v) =>
          navigate({
            search: (s) => ({ ...s, tab: v as typeof tab }),
            resetScroll: false,
          })
        }
      >
        <TabsList variant="line" className="w-full">
          <TabsTrigger value="profile" className="flex-1">
            <User className="size-4" />
            个人资料
          </TabsTrigger>
          <TabsTrigger value="security" className="flex-1">
            <Shield className="size-4" />
            安全
          </TabsTrigger>
          <TabsTrigger value="likes" className="flex-1">
            <Heart className="size-4" />
            喜欢
          </TabsTrigger>
          <TabsTrigger value="favorites" className="flex-1">
            <Bookmark className="size-4" />
            收藏
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

        <TabsContent value="favorites" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">收藏的帖子</CardTitle>
            </CardHeader>
            <CardContent>
              {favLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  加载中...
                </p>
              ) : !favData?.topics?.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  还没有收藏任何帖子
                </p>
              ) : (
                <div className="space-y-3">
                  {favData.topics.map((topic) => (
                    <TopicCard key={topic.id} topic={topic} />
                  ))}
                  {favData.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-4">
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() =>
                          navigate({
                            search: (s) => ({
                              ...s,
                              page: page - 1,
                            }),
                            resetScroll: false,
                          })
                        }
                        className="px-3 py-1 text-sm rounded border disabled:opacity-40"
                      >
                        上一页
                      </button>
                      <span className="text-sm text-muted-foreground">
                        {page} / {favData.totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={page >= favData.totalPages}
                        onClick={() =>
                          navigate({
                            search: (s) => ({
                              ...s,
                              page: page + 1,
                            }),
                            resetScroll: false,
                          })
                        }
                        className="px-3 py-1 text-sm rounded border disabled:opacity-40"
                      >
                        下一页
                      </button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="likes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">喜欢的帖子</CardTitle>
            </CardHeader>
            <CardContent>
              {likeLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  加载中...
                </p>
              ) : !likeData?.topics?.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  还没有喜欢任何帖子
                </p>
              ) : (
                <div className="flex flex-col space-y-3">
                  {likeData.topics.map((topic) => (
                    <TopicCard key={topic.id} topic={topic} />
                  ))}
                  {likeData.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-4">
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() =>
                          navigate({
                            search: (s) => ({
                              ...s,
                              page: page - 1,
                            }),
                            resetScroll: false,
                          })
                        }
                        className="px-3 py-1 text-sm rounded border disabled:opacity-40"
                      >
                        上一页
                      </button>
                      <span className="text-sm text-muted-foreground">
                        {page} / {likeData.totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={page >= likeData.totalPages}
                        onClick={() =>
                          navigate({
                            search: (s) => ({
                              ...s,
                              page: page + 1,
                            }),
                            resetScroll: false,
                          })
                        }
                        className="px-3 py-1 text-sm rounded border disabled:opacity-40"
                      >
                        下一页
                      </button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function UserPageSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <Skeleton className="size-20 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
