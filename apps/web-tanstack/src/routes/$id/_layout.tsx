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
import { GameDetailPageSkeleton } from '@web/components/shared/route-skeletons'
import { seoTemplate } from '@web/config/seoTemplate'
import { gameTitleOf } from '@web/lib/seo'
import { getGameDetail } from '@web/server/game'
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
  loader: async ({ params, context }) => {
    const { id } = params
    // 只阻塞 game，快速点击时首屏秒出；tags 由 TagsCard 组件内 useQuery 自行拉取，
    // 不进入导航关键路径（折叠面板，晚一拍出现无感知）。
    // ensureQueryData 同时把 game 写入查询缓存（key: gameDetail），
    // 由 persist 白名单持久化到 localStorage，刷新/重开后再次访问秒出。
    const game = await context.queryClient.ensureQueryData({
      queryKey: ['gameDetail', id],
      queryFn: () => getGameDetail({ data: { id } }),
      staleTime: 60_000,
    })
    return {
      game,
      id,
    }
  },
  // 仅在真实进入页面(点击/直达/SSR 首屏)时计 view；悬停与空闲预加载不触发 onEnter，不会污染热榜
  onEnter: ({ params }) => {
    void recordGameView({ data: { id: params.id } }).catch(() => {
      // silently ignore recording failures
    })
  },
  pendingComponent: () => <GameDetailPageSkeleton />,
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
        <div>
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
