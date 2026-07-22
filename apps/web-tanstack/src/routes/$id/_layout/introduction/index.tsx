import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { seoTemplate } from '@web/config/seoTemplate'
import { getGameDetail } from '@web/server/game'
import { getintroductionList } from '@web/server/introduction'

const IntroductionPage = lazy(() => import('@web/components/introduction/introduction-page'))

export const Route = createFileRoute('/$id/_layout/introduction/')({
  loader: async ({ params }) => {
    const { id } = params
    return {
      introductionList: await getintroductionList({ data: { id } }),
      id,
      game: await getGameDetail({ data: { id } }),
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `${
          loaderData?.game?.vn_datas?.titles?.find(
            (t) =>
              t.lang === loaderData?.game?.vn_datas?.olang &&
              t.title.trim() !== '',
          )?.title || 'Galgame'
        } 攻略文章列表 | ${seoTemplate.title}`,
      },
    ],
  }),
  headers: () => ({
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
  }),

  // Client-side caching (via TanStack Router)
  staleTime: 60_000, // Consider data fresh for 60 seconds on client
  gcTime: 5 * 60_000, // Keep in memory for 5 minutes

  component: () => {
    const loaderData = Route.useLoaderData()
    return (
      <Suspense fallback={<div>加载中...</div>}>
        <IntroductionPage {...loaderData} />
      </Suspense>
    )
  },
})
