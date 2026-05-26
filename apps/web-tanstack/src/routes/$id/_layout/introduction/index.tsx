import { createFileRoute, Link } from '@tanstack/react-router'
import { NotepadText } from 'lucide-react'
import { seoTemplate } from '@web/config/seoTemplate'
import { getGameDetail } from '@web/server/game'
import { getintroductionList } from '@web/server/introduction'

export const Route = createFileRoute('/$id/_layout/introduction/')({
  component: RouteComponent,
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
  // CDN caching (via headers)
  headers: () => ({
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
  }),
  // Client-side caching (via TanStack Router)
  staleTime: 60_000, // Consider data fresh for 60 seconds on client
  gcTime: 5 * 60_000, // Keep in memory for 5 minutes
})

function RouteComponent() {
  const { introductionList, id } = Route.useLoaderData()
  return (
    <section>
      {!introductionList && <div className="text-center">暂无攻略文章喵～</div>}
      {introductionList && (
        <div className="rounded-lg">
          {introductionList.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between px-2 gap-2 rounded-lg"
            >
              <Link
                to="/$id/introduction/$articleId"
                params={{ id: id, articleId: String(item.id) }}
                resetScroll={false}
                className="w-full"
              >
                <div className="pt-2 flex items-center pb-2 w-full">
                  <NotepadText className="size-4 mr-1" />
                  <span>{item.title}</span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
