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
  // 返回详情页（如从游戏详情回退）时直接用缓存渲染，不重新请求：
  // loader 数据经 ensureQueryData 落入 query 缓存，60s 内秒开不闪骨架屏
  staleTime: 60_000,
  gcTime: 5 * 60_000,
  loader: async ({ params, context }) => {
    const { pid } = params
    return {
      pid: pid,
      producer: await context.queryClient.ensureQueryData({
        queryKey: ['producerInfo', pid],
        queryFn: () => producerInfo({ data: { pid } }),
        staleTime: 60_000,
        gcTime: 5 * 60_000,
      }),
      gameList: context.queryClient.ensureQueryData({
        queryKey: ['producerGameList', pid],
        queryFn: () => producerGameList({ data: { pid } }),
        staleTime: 60_000,
        gcTime: 5 * 60_000,
      }),
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
