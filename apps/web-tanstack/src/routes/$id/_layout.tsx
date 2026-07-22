import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { seoTemplate } from '@web/config/seoTemplate'
import { getGameDetail, getGameTags } from '@web/server/game'

const GameLayoutPage = lazy(() => import('@web/components/game/game-layout-page'))

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
  // Client-side caching (via TanStack Router)
  headers: () => ({
    // Cache at CDN for 1 hour, allow stale content for up to 1 day
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
  }),
  staleTime: 60_000, // Consider data fresh for 60 seconds on client
  gcTime: 5 * 60_000, // Keep in memory for 5 minutes

  component: () => {
    const loaderData = Route.useLoaderData()
    return (
      <Suspense fallback={<div>加载中...</div>}>
        <GameLayoutPage {...loaderData} />
      </Suspense>
    )
  },
})
