import { createFileRoute } from '@tanstack/react-router'
import { ChartAreaLinear } from '@web/components/home/game/translate/chart-area-linear'
import { seoTemplate } from '@web/config/seoTemplate'
import { getGameDetail, translateData } from '@web/server/game'

export const Route = createFileRoute('/$id/_layout/translate')({
  component: RouteComponent,
  loader: async ({ params }) => {
    const { id } = params
    return {
      translateData: await translateData({ data: { id } }),
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
        } 下载统计 | ${seoTemplate.title}`,
      },
    ],
  }),
  // CDN caching (via headers)
  headers: () => ({
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
  }),
  // Client-side caching (via TanStack Router)
  staleTime: 60_000, // Consider data fresh for 60 seconds on client
  gcTime: 5 * 60_000, // Keep in memory for 5 minutes
})

function RouteComponent() {
  return <ChartAreaLinear />
}
