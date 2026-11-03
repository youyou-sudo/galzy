import { useQuery } from '@tanstack/react-query'
import { defineRoute } from "@teyik0/furin"
import { Link } from "@web/lib/nav"
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
import { useSeedQueries } from "@web/lib/query-seed"
import { seoMeta } from '@web/lib/seo'
import { authClient } from '@web/server/auth/auth-client'
import { getTopics } from '@web/server/topics'
import { FileText, Plus } from 'lucide-react'
import type { ComponentProps } from 'react'
import * as z from 'zod/mini'

// `?page=abc` / `?page=0` 等非法值回退到第 1 页，避免 Number() 得到 NaN 后
// 传给 API 触发校验错误（其他分页路由同样用 .catch 兜底）
const topicsSearchSchema = z.object({
  page: z._default(z.catch(z.coerce.number().check(z.int(), z.minimum(1)), 1), 1),
})

type TopicListData = {
  topics: Array<ComponentProps<typeof TopicCard>['topic']>
  total: number
  totalPages: number
}

export const route = defineRoute("/topics")
  .config({ mode: "ssr", query: topicsSearchSchema })
  .loader(async ({ query }) => {
    // 只取公共数据（不带会话）：列表会被预取批量请求，跳过会话省一次往返
    const data = (await getTopics({
      data: { page: query.page, limit: 20, publicOnly: true },
    })) as unknown as TopicListData
    return { data }
  })
  .head(() =>
    seoMeta({
      title: `论坛 | ${seoTemplate.title}`,
      description:
        'GalZY 玩家论坛，讨论 Galgame 汉化资源、攻略心得、游戏推荐与避雷，快来和大家一起交流吧。',
      path: '/topics',
    }),
  )
  .page(({ data, query }) => <TopicsPage data={data} page={query.page} />)

function TopicsPage({ data, page }: { data: TopicListData; page: number }) {
  useSeedQueries([[["topics", page], data]] as never)
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
    queryFn: async () =>
      (await getTopics({ data: { page, limit: 20 } })) as unknown as TopicListData,
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
