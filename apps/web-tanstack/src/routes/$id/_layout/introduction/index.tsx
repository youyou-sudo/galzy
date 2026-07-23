import { createFileRoute } from '@tanstack/react-router'
import IntroductionPage from '@web/components/introduction/introduction-page'
import { seoTemplate } from '@web/config/seoTemplate'
import { getGameDetail } from '@web/server/game'
import { getintroductionList } from '@web/server/introduction'

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
          loaderData?.game?.vn?.titles?.find(
            (t) =>
              t.lang === loaderData?.game?.vn?.olang &&
              t.title.trim() !== '',
          )?.title || 'Galgame'
        } 攻略文章列表 | ${seoTemplate.title}`,
      },
    ],
  }),
  headers: () => ({
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
  }),

  staleTime: 60_000,
  gcTime: 5 * 60_000,

  component: () => {
    const loaderData = Route.useLoaderData()
    return <IntroductionPage {...loaderData} />
  },
})
