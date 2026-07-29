import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { TopicCard } from '@web/components/topics/topic-card'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@web/components/ui/breadcrumb'
import { Button } from '@web/components/ui/button'
import { elysiaErrorF } from '@web/lib'
import { authClient } from '@web/server/auth/auth-client'
import { getTopics } from '@web/server/topics'
import { FileText, Plus } from 'lucide-react'

export const Route = createFileRoute('/topics/')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    page: Number(search.page ?? 1),
  }),
  loaderDeps: ({ search: { page } }) => ({ page }),
  loader: async ({ deps: { page } }) => {
    const data = await getTopics({ data: { page, limit: 20 } })
    return data
  },
})

function RouteComponent() {
  const { page } = Route.useSearch()
  const navigate = useNavigate()
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

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>论坛</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="size-6" />
          <h1 className="text-2xl font-bold">论坛</h1>
        </div>
        {session && (
          <Link to="/topics/create">
            <Button>
              <Plus className="size-4 mr-1" />
              发帖
            </Button>
          </Link>
        )}
      </div>

      <div className="space-y-3">
        {topicData?.topics?.map((topic: any) => (
          <TopicCard key={topic.id} topic={topic} />
        ))}
        {(!topicData?.topics || topicData.topics.length === 0) && (
          <div className="text-center text-muted-foreground py-12">
            暂无帖子
          </div>
        )}
      </div>

      {topicData && topicData.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() =>
              navigate({ to: '/topics', search: { page: page - 1 } })
            }
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {topicData.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= topicData.totalPages}
            onClick={() =>
              navigate({ to: '/topics', search: { page: page + 1 } })
            }
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  )
}
