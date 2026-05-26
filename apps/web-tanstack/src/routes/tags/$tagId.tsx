import { createFileRoute } from '@tanstack/react-router'
import { TagGamelist } from '@web/components/home/tag/tagGameList'
import { Card, CardHeader, CardTitle } from '@web/components/ui/card'
import { seoTemplate } from '@web/config/seoTemplate'
import { getTagData, getVnListByTag } from '@web/server/tags'

export const Route = createFileRoute('/tags/$tagId')({
  component: RouteComponent,
  loader: async ({ params }) => {
    const { tagId } = params
    return {
      tag: await getTagData({ data: { tagId } }),
      game: await getVnListByTag({
        data: { tagId, pageIndex: 0, pageSize: 24 },
      }),
      tagId,
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `${loaderData?.tag?.zht_name || loaderData?.tag?.name || '标签'} | ${seoTemplate.title}`,
      },
      {
        name: 'description',
        content: `${
          loaderData?.tag?.zht_name || loaderData?.tag?.name || '标签'
        } 类型下的游戏列表，类型介绍：${
          loaderData?.tag?.zht_description ||
          loaderData?.tag?.description ||
          '无'
        }`,
      },
    ],
  }),
  headers: () => ({
    // Cache at CDN for 1 hour, allow stale content for up to 1 day
    'Cache-Control':
      'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
  }),
})

function RouteComponent() {
  const { tag } = Route.useLoaderData()
  return (
    <>
      <section className="space-y-3 w-full">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-2xl text-center items-center">
              {tag?.zht_name || tag?.name}
            </CardTitle>
            {/* <CardContent className="p-0">
              <BBCodeRenderer
              text={tag?.zht_description || tag?.description || ''}
              />
              </CardContent> */}
          </CardHeader>
        </Card>
      </section>
      <div className="text-sm text-center items-center opacity-30 italic">
        相关游戏，过滤自 VNDB
      </div>
      <section>
        <TagGamelist />
      </section>
    </>
  )
}
