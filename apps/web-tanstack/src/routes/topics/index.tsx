import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { TopicCard } from '@web/components/topics/topic-card'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@web/components/shared/breadcrumb'
import { EmptyState } from '@web/components/shared/empty-state'
import { PageHeader } from '@web/components/shared/page-header'
import { Pagination } from '@web/components/shared/pagination'
import { Button } from '@web/components/ui/button'
import { seoTemplate } from '@web/config/seoTemplate'
import { elysiaErrorF } from '@web/lib'
import { seoMeta } from '@web/lib/seo'
import { authClient } from '@web/server/auth/auth-client'
import { getTopics } from '@web/server/topics'
import { TopicsListPageSkeleton } from '@web/components/shared/route-skeletons'
import { FileText, Plus } from 'lucide-react'
import * as z from 'zod/mini'

// `?page=abc` / `?page=0` 等非法值回退到第 1 页，避免 Number() 得到 NaN 后
// 传给 API 触发校验错误（其他分页路由同样用 .catch 兜底）
const topicsSearchSchema = z.object({
  page: z._default(z.catch(z.int().check(z.minimum(1)), 1), 1),
})

export const Route = createFileRoute('/topics/')({
  component: RouteComponent,
  pendingComponent: () => <TopicsListPageSkeleton />,
  head: () =>
    seoMeta({
      title: `论坛 | ${seoTemplate.title}`,
      description:
        'GalZY 玩家论坛，讨论 Galgame 汉化资源、攻略心得、游戏推荐与避雷，快来和大家一起交流吧。',
      path: '/topics',
    }),
  validateSearch: topicsSearchSchema,
  loaderDeps: ({ search: { page } }) => ({ page }),
  loader: async ({ deps: { page } }) => {
    const data = await getTopics({ data: { page, limit: 20 } })
    return data
  },
})

function RouteComponent() {
  const { page } = Route.useSearch()
  const { data: session } = useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      const { data: res, error } = await authClient.getSession()
      elysiaErrorF(error)
      return res
    },
  })
  const { data: topicData } = useQuery({
    queryKey: ['topics', page],
    queryFn: async () => await getTopics({ data: { page, limit: 20 } }),
    initialData: Route.useLoaderData(),
  })

  const topics = topicData?.topics ?? []

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>论坛</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        icon={FileText}
        title="论坛"
        description="聊聊汉化资源、攻略心得与游戏推荐，和同好一起交流"
        meta={
          topicData?.total !== undefined ? `共 ${topicData.total} 帖` : undefined
        }
        actions={
          session ? (
            <Button render={<Link to="/topics/create" />}>
              <Plus className="size-4" aria-hidden="true" />
              发帖
            </Button>
          ) : undefined
        }
      />

      {topics.length > 0 ? (
        <div className="flex flex-col gap-3">
          {topics.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      ) : (
        <EmptyState
          surface
          icon={FileText}
          title="还没有帖子"
          description="这里还很安静，发第一帖和大家打个招呼吧"
          action={
            session ? (
              <Button render={<Link to="/topics/create" />}>
                <Plus className="size-4" aria-hidden="true" />
                发第一帖
              </Button>
            ) : (
              <Button
                variant="outline"
                render={<Link to="/auth/login" search={{ return_to: '/topics' }} />}
              >
                登录后发帖
              </Button>
            )
          }
        />
      )}

      <Pagination
        page={page}
        totalPages={topicData?.totalPages ?? 1}
        totalItems={topicData?.total}
        renderLink={(p) => <Link to="/topics" search={{ page: p }} />}
      />
    </div>
  )
}
