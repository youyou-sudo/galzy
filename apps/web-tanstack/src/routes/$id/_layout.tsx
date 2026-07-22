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
    const [game, tags] = await Promise.all([
      getGameDetail({ data: { id } }),
      getGameTags({ data: { id } }),
    ])
    return { game, tags, id }
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
        } 下载 | ${seoTemplate.title}`,
      },
      {
        name: 'description',
        content: `${
          loaderData?.game?.vn_datas?.titles?.find(
            (t) =>
              t.lang === loaderData?.game?.vn_datas?.olang &&
              t.title.trim() !== '',
          )?.title || 'Gamgame'
        } 资源下载，游戏别名：${loaderData?.game?.vn_datas?.alias || '无'}，简介：${loaderData?.game?.vn_datas?.description || '暂无简介'}`,
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
