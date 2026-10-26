import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@web/components/shared/breadcrumb'
import { TopicForm } from '@web/components/topics/topic-form'
import { seoTemplate } from '@web/config/seoTemplate'
import { seoMeta } from '@web/lib/seo'
import { getSession } from '@web/server/auth/auth.functions'
import { createTopic } from '@web/server/topics'
import { toast } from 'sonner'

export const Route = createFileRoute('/topics/create')({
  component: RouteComponent,
  head: () =>
    seoMeta({
      title: `发帖 | ${seoTemplate.title}`,
      noindex: true,
    }),
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) {
      throw redirect({
        to: '/auth/login',
        search: { return_to: '/topics/create' },
      })
    }
  },
})

function RouteComponent() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const handleSubmit = async (values: {
    title: string;
    content: string;
    contentType: "markdown" | "html";
  }) => {
    const result = await createTopic({ data: values })
    queryClient.invalidateQueries({ queryKey: ['topics'] })
    toast.success('发布成功喵～')
    navigate({
      to: '/topics/$topicId',
      params: { topicId: String((result as any).id) },
    })
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/topics" search={{ page: 1 }} />}>
              论坛
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>发帖</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <TopicForm
        onSubmit={handleSubmit}
        title="发帖"
        description="分享资源、攻略或想法，支持 Markdown 与图片"
        submitLabel="发布"
        draftKey="galzy:draft:topic:create"
      />
    </div>
  )
}
