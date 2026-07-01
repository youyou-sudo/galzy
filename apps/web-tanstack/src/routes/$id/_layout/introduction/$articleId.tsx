import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { Button } from '@web/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'
import { seoTemplate } from '@web/config/seoTemplate'
import { elysiaErrorF } from '@web/lib'
import { authClient } from '@web/server/auth/auth-client'
import {
  deleteIntroduction,
  getIntroductionArticle,
} from '@web/server/introduction'
import { ArrowLeft, Loader2, Pencil, Trash2, User } from 'lucide-react'
import { useState } from 'react'
import Markdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'
import { CreateEditDialog } from '../../../../components/-CreateEditDialog'

export const Route = createFileRoute('/$id/_layout/introduction/$articleId')({
  component: RouteComponent,
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
})

function RouteComponent() {
  const { article, gameId, articleId } = Route.useLoaderData()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)

  // Get current user session
  const { data: session } = useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      const { data: res, error } = await authClient.getSession()
      elysiaErrorF(error)
      return res
    },
  })

  const isAdmin = session?.user?.role === 'admin'

  const deleteMutation = useMutation({
    mutationFn: deleteIntroduction,
    onSuccess: () => {
      toast.success('文章已删除～')
      queryClient.invalidateQueries({ queryKey: ['introductionList'] })
      router.navigate({ to: '/$id/introduction', params: { id: gameId } })
    },
    onError: (error: any) => {
      toast.error(error?.message || '删除失败，请稍后重试')
    },
  })

  const handleDelete = () => {
    if (window.confirm(`确定要删除「${article?.title}」吗？此操作不可撤销。`)) {
      deleteMutation.mutate({
        data: {
          strategyId: Number(articleId),
          gameId,
        },
      })
    }
  }

  const handleEditSuccess = () => {
    setDialogOpen(false)
    queryClient.invalidateQueries({ queryKey: ['introductionList'] })
    // Also invalidate the article cache to refresh the content
    router.invalidate({
      filter: (match) =>
        match.routeId === '/$id/_layout/introduction/$articleId',
    })
  }

  return (
    <section>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Link
              to="/$id/introduction"
              params={{ id: gameId }}
              resetScroll={false}
              className="flex items-center pl-3 gap-1 underline opacity-50 hover:opacity-100"
            >
              <ArrowLeft className="size-4" />
              返回
            </Link>

            {/* Admin action buttons */}
            {isAdmin && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDialogOpen(true)}
                >
                  <Pencil className="size-4 mr-1" />
                  编辑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="size-4 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="size-4 mr-1 text-destructive" />
                  )}
                  删除
                </Button>
              </div>
            )}
          </div>
          <CardTitle className="text-2xl items-center text-center">
            {article?.title}
          </CardTitle>
          <CardDescription>
            <div className="flex items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1">
                <User className="size-4" />
                {article?.user?.name ?? '喵喵喵？'}
              </span>
              <span>|</span>
              <span># 攻略</span>
              <span>|</span>
              <span>
                {article?.createdAt
                  ? new Date(article.createdAt).toISOString().split('T')[0]
                  : ''}
              </span>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Markdown rehypePlugins={[rehypeRaw]} remarkPlugins={[remarkGfm]}>
              {article?.content}
            </Markdown>
          </div>
          <div className="text-right">
            {article?.copyright && (
              <p className="text-sm items-center">
                来源：
                <a
                  href={article.copyright}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  {(() => {
                    try {
                      return new URL(article.copyright).hostname.replace(
                        /\.\w+$/,
                        '',
                      )
                    } catch {
                      return article.copyright
                    }
                  })()}
                </a>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {article && (
        <CreateEditDialog
          key={`edit-${dialogOpen}`}
          gameId={gameId}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          mode="edit"
          initialData={{
            id: articleId,
            title: article.title ?? '',
            content: article.content ?? '',
            copyright: article.copyright ?? '',
          }}
          onSuccess={handleEditSuccess}
        />
      )}
    </section>
  )
}
