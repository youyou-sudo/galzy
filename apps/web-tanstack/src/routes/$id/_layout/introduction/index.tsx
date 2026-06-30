import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { Button } from '@web/components/ui/button'
import { seoTemplate } from '@web/config/seoTemplate'
import { elysiaErrorF } from '@web/lib'
import { authClient } from '@web/server/auth/auth-client'
import { getGameDetail } from '@web/server/game'
import {
  deleteIntroduction,
  getintroductionList,
} from '@web/server/introduction'
import { introductionEditActions } from '@web/stores/introductionStores'
import { Loader2, NotepadText, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { CreateEditDialog } from './-CreateEditDialog'

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
  headers: () => ({
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
  }),

  // Client-side caching (via TanStack Router)
  staleTime: 60_000, // Consider data fresh for 60 seconds on client
  gcTime: 5 * 60_000, // Keep in memory for 5 minutes
})

function RouteComponent() {
  const { introductionList, id } = Route.useLoaderData()
  const router = useRouter()

  // Get current user session
  const { data: session, isPending: sessionPending } = useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      const { data: res, error } = await authClient.getSession()
      elysiaErrorF(error)
      return res
    },
  })

  const isAdmin = session?.user?.role === 'admin'
  const isLoggedIn = !!session?.user

  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set())

  const deleteMutation = useMutation({
    mutationFn: deleteIntroduction,
    onSuccess: () => {
      toast.success('文章已删除～')
      router.invalidate({
        filter: (match) =>
          match.routeId === '/$id/_layout/introduction/',
      })
    },
    onError: (error: any) => {
      toast.error(error?.message || '删除失败，请稍后重试')
    },
    onSettled: (_data, _error, variables) => {
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(variables.data.strategyId)
        return next
      })
    },
  })

  const handleDelete = (strategyId: number) => {
    setDeletingIds((prev) => new Set(prev).add(strategyId))
    deleteMutation.mutate({
      data: {
        strategyId,
        gameId: id,
      },
    })
  }

  return (
    <section>
      {/* Header with create button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">攻略文章</h2>
        {isLoggedIn && !sessionPending && (
          <Button
            onClick={() => {
              introductionEditActions.onOpen()
            }}
            size="sm"
            variant="outline"
          >
            <Plus className="size-4 mr-1" />
            {isAdmin ? '创建文章' : '提交攻略'}
          </Button>
        )}
      </div>

      {(!introductionList || introductionList.length === 0) && (
        <div className="text-center text-muted-foreground py-8">
          暂无攻略文章喵～
          {isLoggedIn && !sessionPending && (
            <div className="mt-2">
              <Button
                onClick={() => {
                  introductionEditActions.onOpen()
                }}
                variant="outline"
                size="sm"
              >
                <Plus className="size-4 mr-1" />
                {isAdmin ? '来写第一篇攻略吧～' : '来提交第一篇攻略吧～'}
              </Button>
            </div>
          )}
        </div>
      )}

      {introductionList && introductionList.length > 0 && (
        <div className="rounded-lg">
          {introductionList.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between px-2 gap-2 rounded-lg group hover:bg-muted/50"
            >
              <Link
                to="/$id/introduction/$articleId"
                params={{ id: id, articleId: String(item.id) }}
                resetScroll={false}
                className="w-full min-w-0"
              >
                <div className="py-2 flex items-center w-full min-w-0">
                  <NotepadText className="size-4 mr-1 shrink-0" />
                  <span className="truncate">{item.title}</span>
                </div>
              </Link>

              {/* Admin action buttons */}
              {isAdmin && (
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      introductionEditActions.setOpen({
                        gameId: id,
                        id: String(item.id),
                        title: item.title,
                        content: item.content,
                        copyright: item.copyright,
                      })
                    }}
                    title="编辑"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleDelete(item.id)
                    }}
                    disabled={deletingIds.has(item.id)}
                    title="删除"
                  >
                    {deletingIds.has(item.id) ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5 text-destructive" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CreateEditDialog gameId={id} />
    </section>
  )
}
