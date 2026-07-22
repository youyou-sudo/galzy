import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { seoTemplate } from '@web/config/seoTemplate'
import { getIntroductionArticle } from '@web/server/introduction'

const ArticlePage = lazy(() => import('@web/components/introduction/article-page'))

export const Route = createFileRoute('/$id/_layout/introduction/$articleId')({
  loader: async ({ params }) => {
    return {
      article: await getIntroductionArticle({
        data: { id: params.articleId },
      }),
      gameId: params.id,
      articleId: params.articleId,
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.article?.title} | ${seoTemplate.title}` },
      {
        name: 'description',
        content: `${loaderData?.article?.title}`,
      },
    ],
  }),
  headers: () => ({
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
  }),

  // Client-side caching (via TanStack Router)
  staleTime: 60_000,
  gcTime: 5 * 60_000,

  component: () => {
    const loaderData = Route.useLoaderData()
    return (
      <Suspense fallback={<div>加载中...</div>}>
        <ArticlePage {...loaderData} />
      </Suspense>
    )
  },
})
