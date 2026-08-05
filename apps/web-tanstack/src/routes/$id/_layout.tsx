import { createFileRoute, Link, useRouterState } from '@tanstack/react-router'
import GameLayoutPage from '@web/components/game/game-layout-page'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@web/components/ui/breadcrumb'
import { seoTemplate } from '@web/config/seoTemplate'
import { gameTitleOf } from '@web/lib/seo'
import { getGameDetail, getGameTags } from '@web/server/game'
import { recordGameView } from '@web/server/views'

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
    // Record game view for hot ranking — fire-and-forget, must not delay first paint
    void recordGameView({ data: { id } }).catch(() => {
      // silently ignore recording failures
    })
    const [game, tags] = await Promise.all([
      getGameDetail({ data: { id } }),
      getGameTags({ data: { id } }),
    ])
    return {
      game,
      tags,
      id,
    }
  },
  head: ({ loaderData }) => {
    const title = gameTitleOf(loaderData?.game)
    return {
      meta: [
        {
          title: `${title} 下载 | ${seoTemplate.title}`,
        },
        {
          name: 'description',
          content: `${title} 资源下载，游戏别名：${loaderData?.game?.vn?.alias || '无'}，简介：${loaderData?.game?.vn?.description || '暂无简介'}`,
        },
      ],
    }
  },
  headers: ({ params }) => ({
    'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300',
    'Cache-Tag': `game-${params.id},page-game`,
  }),
  staleTime: 60_000,
  gcTime: 5 * 60_000,

  component: () => {
    const loaderData = Route.useLoaderData()
    const routerState = useRouterState()
    const gameTitle = gameTitleOf(loaderData?.game)

    // Check if we're on an introduction article page
    const match = routerState.matches.find(
      (m) => m.routeId === '/$id/_layout/introduction/$articleId',
    )
    const articleTitle = match
      ? (match.loaderData as any)?.article?.title
      : null

    return (
      <>
        <div className="max-w-7xl mx-auto w-full px-3 md:px-6 pt-6">
          <Breadcrumb className="mb-4">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link to="/games" />}>
                  全部游戏
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink
                  render={<Link to="/$id" params={{ id: loaderData.id }} />}
                >
                  {gameTitle}
                </BreadcrumbLink>
              </BreadcrumbItem>
              {articleTitle && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      render={
                        <Link
                          to="/$id/introduction"
                          params={{ id: loaderData.id }}
                        />
                      }
                    >
                      攻略
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{articleTitle}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <GameLayoutPage {...loaderData} />
      </>
    )
  },
})
