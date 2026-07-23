import { createFileRoute } from '@tanstack/react-router'
import GameLayoutPage from '@web/components/game/game-layout-page'
import { seoTemplate } from '@web/config/seoTemplate'
import { getGameDetail, getGameTags } from '@web/server/game'

export const Route = createFileRoute('/$id/_layout')({
  params: {
    parse: ({ id }) => {
      const match = id.match(/^([vd])(\d+)$/)
      if (!match) return false
      return {
        id,
      }
    },
    stringify: ({ id }) => ({
      id,
    }),
  },
  loader: async ({ params }) => {
    const { id } = params
    return {
      game: await getGameDetail({ data: { id } }),
      tags: getGameTags({ data: { id } }),
      id,
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
        } 下载 | ${seoTemplate.title}`,
      },
      {
        name: 'description',
        content: `${
          loaderData?.game?.vn?.titles?.find(
            (t) =>
              t.lang === loaderData?.game?.vn?.olang &&
              t.title.trim() !== '',
          )?.title || 'Gamgame'
        } 资源下载，游戏别名：${loaderData?.game?.vn?.alias || '无'}，简介：${loaderData?.game?.vn?.description || '暂无简介'}`,
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
    return <GameLayoutPage {...loaderData} />
  },
})
