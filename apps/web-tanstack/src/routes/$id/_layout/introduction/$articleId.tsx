import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, User } from 'lucide-react'
import Markdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { seoTemplate } from '#/config/seoTemplate'
import { getIntroductionArticle } from '#/server/introduction'

export const Route = createFileRoute('/$id/_layout/introduction/$articleId')({
  component: RouteComponent,
  loader: async ({ params }) => {
    return getIntroductionArticle({
      data: { id: params.articleId },
    })
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title} | ${seoTemplate.title}` },
      {
        name: 'description',
        content: `${loaderData?.title}`,
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
  const content = Route.useLoaderData()
  return (
    <section>
      <Card>
        <CardHeader>
          <Link
            to=".."
            resetScroll={false}
            className="flex items-center pl-3 gap-1 underline opacity-50 hover:opacity-100"
          >
            <ArrowLeft className="size-4" />
            返回
          </Link>
          <CardTitle className="text-2xl items-center text-center">
            {content?.title}
          </CardTitle>
          <CardDescription>
            <div className="flex items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1">
                <User className="size-4" />
                喵喵喵？
              </span>
              <span>|</span>
              <span># 攻略</span>
              <span>|</span>
              <span>{content?.createdAt.toISOString().split('T')[0]}</span>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Markdown rehypePlugins={[rehypeRaw]} remarkPlugins={[remarkGfm]}>
              {content?.content}
            </Markdown>
          </div>
          <div className="text-right">
            {content?.copyright && (
              <p className="text-sm items-center">
                来源：
                <a
                  href={content.copyright}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  {new URL(content.copyright).hostname.replace(/\.\w+$/, '')}
                </a>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
