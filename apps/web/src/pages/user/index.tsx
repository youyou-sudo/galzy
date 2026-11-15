import { useQuery } from '@tanstack/react-query'
import { defineRoute } from '@teyik0/furin'
import { useShallowSearch } from '@web/lib/admin/use-shallow-search'
import { Link, redirect } from '@web/lib/nav'
import { useSeedQueries } from '@web/lib/query-seed'
import { EmptyState } from '@web/components/shared/empty-state'
import { PageHeader } from '@web/components/shared/page-header'
import { Pagination } from '@web/components/shared/pagination'
import { TopicCard } from '@web/components/topics/topic-card'
import { Button } from '@web/components/ui/button'
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
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import * as z from 'zod/mini'

const errorMessages: Record<string, string> = {
  "email_doesn't_match":
    '当前账户邮箱与第三方账户邮箱不一致，无法绑定。如需绑定不同邮箱的账户，请联系管理员喵～',
  account_already_linked_to_different_user:
    '该第三方账户已绑定到其他用户，无法重复绑定。',
  unable_to_link_account: '账户关联失败，请稍后重试。',
}

const UserSearchSchema = z.object({
  error: z.optional(z.string()),
  error_description: z.optional(z.string()),
  tab: z._default(
    z.optional(z.enum(['profile', 'security', 'favorites', 'likes'])),
    'profile',
  ),
  page: z._default(z.optional(z.coerce.number()), 1),
})

/** 账户页的静态标签页配置：真实页与 pending 骨架共用，标签文案/图标只写一份 */
const USER_TABS = [
  { value: 'profile', label: '个人资料', icon: User, cardTitle: '个人资料' },
  { value: 'security', label: '安全', icon: Shield, cardTitle: '安全设置' },
  { value: 'likes', label: '喜欢', icon: Heart, cardTitle: '喜欢的帖子' },
  { value: 'favorites', label: '收藏', icon: Bookmark, cardTitle: '收藏的帖子' },
] as const

/** 页签值的联合类型（与 route 的 query schema 同源，改 schema 这里自动跟着变）。 */
type UserTab = UserSearch['tab']

/** Base UI 的 value 是 `any`：只接受 USER_TABS 里登记过的值，避免写进脏 query。 */
function isUserTab(value: unknown): value is UserTab {
  return USER_TABS.some((tab) => tab.value === value)
}

/** 页签栏：真实页和 pending 态共用，加载时标签也是可读的真实 HTML */
function UserTabsList() {
  return (
    <TabsList variant="line" className="w-full">
      {USER_TABS.map(({ value, label, icon: Icon }) => (
        <TabsTrigger key={value} value={value} className="flex-1">
          <Icon className="size-4" />
          {label}
        </TabsTrigger>
      ))}
    </TabsList>
  )
}

/** 当前标签页对应的卡片外壳：标题来自静态配置，真实页与 pending 共用 */
function UserTabCard({
  value,
  children,
}: {
  value: (typeof USER_TABS)[number]['value']
  children: ReactNode
}) {
  const tab = USER_TABS.find((item) => item.value === value)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold tracking-tight">
          {tab?.cardTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

/** 用户信息卡的静态外壳：卡片本身不依赖请求，pending 时也直接渲染 */
function UserCardShell({ children }: { children: ReactNode }) {
  return (
    // Card 自带 py-4，CardContent 再写 pt-6 会叠出 40px 顶部留白、底部却只有 16px。
    // 这里把 Card 的纵向内边距归零，由 CardContent 统一给 16/20px 的对称留白。
    <Card className="py-0">
      <CardContent className="p-4 sm:p-5">{children}</CardContent>
    </Card>
  )
}

/** 收藏/喜欢列表的加载态：真实页和 pending 态共用同一份 */
function TopicListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="w-full h-28 rounded-2xl" />
      ))}
    </div>
  )
}

/** 个人资料/安全设置的表单加载态 */
function FormSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="w-16 h-3" />
          <Skeleton className="w-full h-9 rounded-xl" />
        </div>
      ))}
      <Skeleton className="w-24 h-9 rounded-lg" />
    </div>
  )
}

export const route = defineRoute('/user/')
  .config({ mode: 'ssr', query: UserSearchSchema })
  .loader(async ({ query }) => {
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/auth/login' })
    }

    const page = query.page
    const [accounts, favorites, likes] = await Promise.all([
      listAccounts().then(({ data, error }) => {
        elysiaErrorF(error)
        return data ?? []
      }),
      getUserFavorites({ data: { page, limit: 10 } }),
      getUserLikes({ data: { page, limit: 10 } }),
    ])

    return { session, accounts, favorites, likes }
  })
  .head(() =>
    seoMeta({
      title: '个人中心 | GalZY - Galgame 资源站',
      noindex: true,
    }),
  )
  .page(({ session, accounts, favorites, likes, query }) => (
    <UserPage
      session={session}
      accounts={accounts}
      favorites={favorites}
      likes={likes}
      search={query}
    />
  ))

type UserSearch = z.infer<typeof UserSearchSchema>

/** 个人中心主体（导出以便单测直接渲染；路由只认本文件的 `route`）。 */
export function UserPage({
  session,
  accounts,
  favorites,
  likes,
  search,
}: {
  session: Awaited<ReturnType<typeof getSession>>
  accounts: Awaited<ReturnType<typeof listAccounts>>['data']
  favorites: Awaited<ReturnType<typeof getUserFavorites>>
  likes: Awaited<ReturnType<typeof getUserLikes>>
  search: UserSearch
}) {
  useSeedQueries([
    [['linked-accounts'], accounts],
    [['userFavorites', search.page], favorites],
    [['userLikes', search.page], likes],
  ] as never)
  const { error: errorCode, error_description: errorDescription } = search
  /**
   * 页签 / 分页是**页内状态**：写进地址栏（可分享、刷新可还原），但改地址栏用
   * `history.replaceState` 而不是 furin 导航。
   *
   * 之前这里走 `navigate({ to: '/user', search: ... })`，一次点击会重新请求
   * `?_furin=data`、重跑整条 loader（会话 + 账号列表 + 收藏/喜欢两个列表），
   * 等于切个页签要等一轮 web → API → DB；这期间界面没有任何反馈（没有 pending
   * 组件，旧内容原样留在屏上），点起来就像「页签点不动」。面板本身是纯客户端
   * 数据（`useQuery` 已按 page 缓存），根本不需要重新取页面。
   */
  const [{ tab, page }, patchSearch] = useShallowSearch<{
    tab: UserTab
    page: number
  }>({ tab: search.tab, page: search.page }, { tab: 'profile', page: 1 })

  const { data: clientSession, refetch: refetchSession } =
    authClient.useSession()
  const user = clientSession?.user ?? session?.user

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

  const goPage = (next: number) => patchSearch({ page: next })

  if (!user) return null

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        icon={User}
        title="个人中心"
        description="管理头像、账户安全，以及收藏和喜欢的帖子"
      />

      <div className="space-y-6">
        {/* 用户头部信息 */}
        <UserCardShell>
          <div className="flex flex-col gap-4 items-center sm:flex-row sm:items-start">
              <div className="flex flex-col gap-1.5 items-center">
                <AvatarComp name={user.name} image={user.image} editor />
                <span className="text-xs text-muted-foreground/70 cursor-default select-none">
                  点击更换头像
                </span>
              </div>
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <h2 className="text-lg font-semibold tracking-tight truncate">
                  {user.name}
                </h2>
                <p className="flex gap-1 justify-center items-center mt-1 text-xs text-muted-foreground sm:justify-start">
                  <Mail className="shrink-0 size-3.5" aria-hidden="true" />
                  <span className="truncate">{user.email}</span>
                </p>
            </div>
          </div>
        </UserCardShell>

        {/* 标签页：个人资料 & 安全 & 收藏 & 喜欢 */}
        <Tabs
          value={tab}
          onValueChange={(v) => {
            if (isUserTab(v)) patchSearch({ tab: v })
          }}
        >
          <UserTabsList />

          <TabsContent value="profile" className="mt-4">
            <UserTabCard value="profile">
              <ProfileTab user={user} onProfileUpdated={refetchSession} />
            </UserTabCard>
          </TabsContent>

          <TabsContent value="security" className="mt-4">
            <UserTabCard value="security">
              <SecurityTab />
            </UserTabCard>
          </TabsContent>

          <TabsContent value="favorites" className="mt-4">
            <UserTabCard value="favorites">
                {favLoading ? (
                  <TopicListSkeleton />
                ) : !favData?.topics?.length ? (
                  <EmptyState
                    size="sm"
                    icon={Bookmark}
                    title="还没有收藏任何帖子"
                    description="在帖子详情页点收藏，这里就能找回来"
                    action={
                      <Button
                        variant="outline"
                        render={<Link to="/topics" search={{ page: 1 }} />}
                      >
                        去论坛逛逛
                      </Button>
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {favData.topics.map((topic: any) => (
                      <TopicCard key={topic.id} topic={topic} />
                    ))}
                    <Pagination
                      page={page}
                      totalPages={favData.totalPages}
                      totalItems={favData.total}
                      onPageChange={goPage}
                    />
                  </div>
                )}
            </UserTabCard>
          </TabsContent>

          <TabsContent value="likes" className="mt-4">
            <UserTabCard value="likes">
                {likeLoading ? (
                  <TopicListSkeleton />
                ) : !likeData?.topics?.length ? (
                  <EmptyState
                    size="sm"
                    icon={Heart}
                    title="还没有喜欢任何帖子"
                    description="看到喜欢的帖子点个赞，就会出现在这里"
                    action={
                      <Button
                        variant="outline"
                        render={<Link to="/topics" search={{ page: 1 }} />}
                      >
                        去论坛逛逛
                      </Button>
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {likeData.topics.map((topic: any) => (
                      <TopicCard key={topic.id} topic={topic} />
                    ))}
                    <Pagination
                      page={page}
                      totalPages={likeData.totalPages}
                      totalItems={likeData.total}
                      onPageChange={goPage}
                    />
                  </div>
                )}
            </UserTabCard>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

/**
 * 路由 pending：标题、页签、卡片外壳都是静态 HTML，直接渲染真实组件；
 * 只有用户资料（头像/昵称/邮箱）和表单/帖子内容出骨架。
 * 这样加载完成时只换内容，不会整页重排，也不会把「个人中心」标题变成灰条。
 */
export function UserPageSkeleton({
  tab,
  onTabChange,
}: {
  tab: UserSearch['tab']
  onTabChange: (value: UserSearch['tab']) => void
}) {

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        icon={User}
        title="个人中心"
        description="管理头像、账户安全，以及收藏和喜欢的帖子"
      />

      <div className="space-y-6">
        {/* 用户资料卡：卡片外壳固定，只有头像和文字出骨架 */}
        <UserCardShell>
          <div className="flex flex-col gap-4 items-center sm:flex-row sm:items-start">
            <div className="flex flex-col gap-1.5 items-center">
              <Skeleton className="size-10 rounded-full" />
              <Skeleton className="w-20 h-3" />
            </div>
            <div className="flex-1 space-y-2">
              <Skeleton className="w-32 h-5" />
              <Skeleton className="w-48 h-3.5" />
            </div>
          </div>
        </UserCardShell>

        {/* 页签栏是静态导航，加载中也可用；内容区按当前 tab 出对应骨架 */}
        <Tabs
          value={tab}
          onValueChange={(v) =>
            onTabChange(v as typeof tab)
          }
        >
          <UserTabsList />
          {USER_TABS.map(({ value }) => (
            <TabsContent key={value} value={value} className="mt-4">
              <UserTabCard value={value}>
                {value === "profile" || value === "security" ? (
                  <FormSkeleton />
                ) : (
                  <TopicListSkeleton />
                )}
              </UserTabCard>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}
