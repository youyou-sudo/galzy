import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { seoTemplate } from '@web/config/seoTemplate'
import { getTagData, getVnListByTag } from '@web/server/tags'

const TagDetailPage = lazy(() => import('@web/components/tags/tag-detail-page'))

export const Route = createFileRoute('/tags/$tagId')({
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
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
  }),

  component: () => {
    const loaderData = Route.useLoaderData()
    return (
      <Suspense fallback={<div>加载中...</div>}>
        <TagDetailPage {...loaderData} />
      </Suspense>
    )
  },
})
