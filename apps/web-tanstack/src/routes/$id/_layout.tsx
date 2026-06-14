import { createFileRoute, Outlet } from '@tanstack/react-router'
import { GameHeader } from '@web/components/home/game/GameHeader'
import { GameInfo } from '@web/components/home/game/GameInfo'
import { GameTabs } from '@web/components/home/game/GameTabs'
import { Glgczujm } from '@web/components/home/game/tips'
import { Card, CardContent } from '@web/components/ui/card'
import { GameViewsTrackEvents } from '@web/components/umami/track-events'
import { seoTemplate } from '@web/config/seoTemplate'
import { getGameDetail, getGameTags } from '@web/server/game'
import { useState } from 'react'

export const Route = createFileRoute('/$id/_layout')({
  component: RouteComponent,
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
})

function RouteComponent() {
  const { game, id } = Route.useLoaderData()
  const [currentTab, setCurrentTab] = useState('download')
  return (
    <div className="space-y-3">
      <Card className="overflow-hidden wrap-break-word border-0 pb-0 ">
        <CardContent>
          <GameHeader game={game} />
          <GameInfo game={game} />
        </CardContent>
      </Card>

      <GameTabs id={id} currentTab={currentTab} setCurrentTab={setCurrentTab} />
      <Card className="p-1">
        <CardContent className="p-1">
          <Outlet />
          <Glgczujm />
        </CardContent>
      </Card>
      <GameViewsTrackEvents idtitle={id} />
    </div>
  )
}
