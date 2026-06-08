import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { BBCodeRenderer } from '@web/components/bbcode'
import { GameCard } from '@web/components/home/card'
import { TagsCard } from '@web/components/home/game/tags'
import { Glgczujm } from '@web/components/home/game/tips'
import { Card, CardContent } from '@web/components/ui/card'
import { Skeleton } from '@web/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@web/components/ui/tabs'
import { GameViewsTrackEvents } from '@web/components/umami/track-events'
import { seoTemplate } from '@web/config/seoTemplate'
import { formatLooseDate, getImageUrl } from '@web/lib'
import { getGameDetail, getGameTags } from '@web/server/game'
import {
  ArrowDownToLine,
  MessageCircle,
  Search,
  Swords,
  TrendingUp,
} from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/$id/_layout')({
  component: RouteComponent,
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
          {/* Cover and basic info section */}
          <div className="sm:float-right text-center sm:text-right sm:ml-4 pb-4 relative">
            <div className="relative inline-block">
              <div
                className={`${
                  game?.vn_datas?.images?.height &&
                  game?.vn_datas?.images?.height < game?.vn_datas?.images?.width
                    ? 'min-w-72.5'
                    : 'max-w-55'
                } relative overflow-hidden text-left`}
              >
                <Skeleton className="absolute inset-0 w-full h-full rounded-lg" />
                <GameCard.Image
                  width={game?.vn_datas?.images?.width ?? 200}
                  height={game?.vn_datas?.images?.height ?? 300}
                  loading="lazy"
                  decoding="async"
                  src={getImageUrl({
                    imageId: game?.vn_datas?.images?.id,
                    width: game?.vn_datas?.images?.width,
                    height: game?.vn_datas?.images?.height,
                  })}
                  alt={
                    game?.vn_datas?.titles?.find(
                      (t) =>
                        t.lang === game.vn_datas?.olang &&
                        t.title.trim() !== '',
                    )?.title || 'null'
                  }
                  className="rounded-lg inset-0 w-full h-full object-cover relative"
                />
              </div>
            </div>
          </div>

          {/* Main content section */}
          <div className="overflow-hidden wrap-break-word">
            <h1 className="font-semibold text-2xl leading-[1.2] mt-2">
              {game?.vn_datas?.titles?.find(
                (t) => t.lang === game.vn_datas?.olang && t.title.trim() !== '',
              )?.title || 'null'}
            </h1>

            {/* Aliases */}
            {game?.vn_datas?.alias && (
              <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-[1.2]">
                别名:{' '}
                {game?.vn_datas?.alias
                  .split('\n')
                  .flatMap((s) => {
                    const trimmed = s.trim()
                    return trimmed ? [trimmed] : []
                  })
                  .filter(
                    (s) =>
                      s !==
                      game?.vn_datas?.titles?.find((t) => t.lang === 'zh-Hans')
                        ?.title,
                  )
                  .join(', ')}
              </div>
            )}

            {/* 发行日期 */}
            {game?.released_first && (
              <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                发布：
                <Link
                  to="/search"
                  search={{
                    startDate: `${formatLooseDate(String(game.released_first)).year}-01-01`,
                    endDate: `${formatLooseDate(String(game.released_first)).year}-12-31`,
                  }}
                  className="relative inline-flex items-center gap-0.5 text-cyan-600"
                >
                  <span className="relative">
                    {formatLooseDate(String(game.released_first)).year}-
                    {formatLooseDate(String(game.released_first)).formatted}
                    <Search className="absolute -top-1 -right-3 size-3 text-zinc-400" />
                  </span>
                </Link>
              </div>
            )}

            {/*开发组织*/}
            {game?.producers && (
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                开发：
                {game.producers
                  .filter((producer) => producer.type === 'co')
                  .filter((producer) => producer.is_dev === true)
                  .map((producer, index, arr) => (
                    <Link
                      to={`/producer/$pid`}
                      params={{ pid: producer.id }}
                      key={producer.id}
                    >
                      <span className="relative inline-flex items-center gap-0.5 text-cyan-600 wrap-break-word hover:underline">
                        {producer.name}
                      </span>
                      {index < arr.length - 1 ? ' & ' : ''}
                    </Link>
                  ))}
              </div>
            )}

            {/*发行组织*/}
            {game?.producers && (
              <div className="text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">发行：</span>
                <span className="">
                  {game.producers
                    .filter((producer) => producer.is_pub === true)
                    .map((producer, index, arr) => (
                      <Link
                        to={`/producer/$pid`}
                        params={{ pid: producer.id }}
                        key={producer.id}
                      >
                        <span
                          className={`${producer.type === 'ng' ? 'text-cyan-900 opacity-50 dark:opacity-100' : 'text-cyan-600'} wrap-break-word hover:underline`}
                        >
                          {producer.name}
                        </span>
                        {index < arr.length - 1 ? (
                          <span className="text-zinc-500 dark:text-zinc-400 opacity-100">
                            {' '}
                            &{' '}
                          </span>
                        ) : (
                          ''
                        )}
                      </Link>
                    ))}
                </span>
              </div>
            )}

            {/* Description */}
            {(game?.other_datas?.description ||
              game?.vn_datas?.description) && (
              <div className="mt-2">
                <div className="text-xs text-zinc-500 uppercase mb-1">
                  游戏简介
                </div>
                <div className="text-sm line-clamp-6  leading-relaxed text-zinc-800 dark:text-zinc-200">
                  <BBCodeRenderer
                    text={
                      game?.other_datas?.description ||
                      game?.vn_datas?.description ||
                      ''
                    }
                  />
                </div>
              </div>
            )}
            {/* Tags section */}
            <TagsCard />
          </div>
        </CardContent>
      </Card>

      <Tabs value={currentTab}>
        <TabsList>
          <TabsTrigger value="download" asChild>
            <Link
              to="/$id"
              params={{ id: id }}
              resetScroll={false}
              activeProps={() => {
                setCurrentTab('download')
                return {}
              }}
            >
              <ArrowDownToLine className="size-4" />
              下载
            </Link>
          </TabsTrigger>
          <TabsTrigger value="introduction" asChild>
            <Link
              to="/$id/introduction"
              params={{ id: id }}
              resetScroll={false}
              activeProps={() => {
                setCurrentTab('introduction')
                return {}
              }}
            >
              <Swords />
              攻略
            </Link>
          </TabsTrigger>
          <TabsTrigger value="comment" asChild>
            <Link
              to="/$id/comment"
              params={{ id: id }}
              resetScroll={false}
              activeProps={() => {
                setCurrentTab('comment')
                return {}
              }}
            >
              <MessageCircle />
              讨论
            </Link>
          </TabsTrigger>
          <TabsTrigger value="translate" asChild>
            <Link
              to="/$id/translate"
              params={{ id: id }}
              resetScroll={false}
              activeProps={() => {
                setCurrentTab('translate')
                return {}
              }}
            >
              <TrendingUp />
              统计
            </Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>
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
