import { createFileRoute, Link } from '@tanstack/react-router'
import ProducerDetailPage from '@web/components/producer/producer-detail-page'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@web/components/ui/breadcrumb'
import { seoTemplate } from '@web/config/seoTemplate'
import { seoMeta } from '@web/lib/seo'
import { ProducerDetailPageSkeleton } from '@web/components/shared/route-skeletons'
import { producerGameList, producerInfo } from '@web/server/producer'

export const Route = createFileRoute('/producer/$pid')({
  pendingComponent: () => <ProducerDetailPageSkeleton />,
  loader: async ({ params }) => {
    const { pid } = params
    return {
      pid: pid,
      producer: await producerInfo({ data: { pid } }),
      gameList: producerGameList({ data: { pid } }),
    }
  },
  head: ({ loaderData, params }) =>
    seoMeta({
      title: `${loaderData?.producer?.name || '厂商'} | ${seoTemplate.title}`,
      description: loaderData?.producer?.name
        ? `${loaderData.producer.name} 出品的全部 Galgame 作品与下载资源，尽在 GalZY。`
        : undefined,
      path: `/producer/${params.pid}`,
    }),
  headers: ({ params }) => ({
    'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
    'Cache-Tag': `producer-${params.pid},page-producer-detail`,
  }),

  component: () => {
    const loaderData = Route.useLoaderData()
    const producerName = loaderData.producer?.name || '厂商'
    return (
      <div>
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link to="/producer" />}>
                厂商
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{producerName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <ProducerDetailPage {...loaderData} />
      </div>
    )
  },
})
