import { createFileRoute } from '@tanstack/react-router'
import ProducerDetailPage from '@web/components/producer/producer-detail-page'
import { producerGameList, producerInfo } from '@web/server/producer'

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
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
  }),

  component: () => {
    const loaderData = Route.useLoaderData()
    return <ProducerDetailPage {...loaderData} />
  },
})
