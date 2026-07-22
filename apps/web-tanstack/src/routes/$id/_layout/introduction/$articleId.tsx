import { createFileRoute } from '@tanstack/react-router'
import ArticlePage from '@web/components/introduction/article-page'
import { seoTemplate } from '@web/config/seoTemplate'
import { getIntroductionArticle } from '@web/server/introduction'

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

  staleTime: 60_000,
  gcTime: 5 * 60_000,

  component: () => {
    const loaderData = Route.useLoaderData()
    return <ArticlePage {...loaderData} />
  },
})
