import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { producerGameList, producerInfo } from '@web/server/producer'

const ProducerDetailPage = lazy(() => import('@web/components/producer/producer-detail-page'))

export const Route = createFileRoute('/producer/$pid')({
  loader: async ({ params }) => {
    const { pid } = params
    return {
      pid: pid,
      producer: await producerInfo({ data: { pid } }),
      gameList: producerGameList({ data: { pid } }),
    }
  },
  headers: () => ({
    // Cache at CDN for 1 hour, allow stale content for up to 1 day
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
  }),

  component: () => {
    const loaderData = Route.useLoaderData()
    return (
      <Suspense fallback={<div>加载中...</div>}>
        <ProducerDetailPage {...loaderData} />
      </Suspense>
    )
  },
})
