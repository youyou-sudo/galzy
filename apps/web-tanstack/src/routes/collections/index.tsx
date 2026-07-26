import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Badge } from '@web/components/ui/badge'
import { Button } from '@web/components/ui/button'
import { getCollectionPreview, getCollections } from '@web/server/collections'
import { getImageUrl } from '@web/lib/image-url'
import { Package } from 'lucide-react'

export const Route = createFileRoute('/collections/')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    page: Number(search.page ?? 1),
  }),
  loaderDeps: ({ search: { page } }) => ({ page }),
  loader: async ({ deps: { page } }) => {
    const data = await getCollections({ data: { page, limit: 20 } })
    const items = (data as any).items ?? []
    // 并行获取每个合集的预览
    const previews = await Promise.all(
      items.map((c: any) =>
        getCollectionPreview({ data: { id: String(c.id), limit: 6 } }).catch(() => [])
      )
    )
    return { collections: items, previews, total: (data as any).total }
  },
})

function RouteComponent() {
  const { page } = Route.useSearch()
  const navigate = useNavigate()
  const loaderData = Route.useLoaderData()
  const { data: collectionData } = useQuery({
    queryKey: ['collections', page],
    queryFn: async () => {
      const data = await getCollections({ data: { page, limit: 20 } })
      const items = (data as any).items ?? []
      const previews = await Promise.all(
        items.map((c: any) =>
          getCollectionPreview({ data: { id: String(c.id), limit: 6 } }).catch(() => [])
        )
      )
      return { collections: items, previews, total: (data as any).total }
    },
    initialData: loaderData,
  })

  const items = collectionData?.collections ?? []
  const previews = collectionData?.previews ?? []
  const total = Number(collectionData?.total ?? 0)
  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const typeLabel: Record<string, string> = {
    manual: '手动选择',
    producer: '会社绑定',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-6 px-4 sm:px-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="size-6" />
          <h1 className="text-2xl font-bold">合集</h1>
        </div>
        <span className="text-sm text-muted-foreground">共 {total} 个合集</span>
      </div>

      <div className="space-y-4">
        {items.map((collection: any, index: number) => (
          <div
            key={collection.id}
            className="border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer"
            onClick={() => navigate({ to: '/collections/$id', params: { id: String(collection.id) } })}
          >
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-semibold">
                    {collection.title}
                  </h2>
                  <Badge variant="secondary">
                    {typeLabel[collection.type] ?? collection.type}
                  </Badge>
                </div>
                {collection.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {collection.description}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0 self-end sm:self-auto">
                <div className="flex items-center">
                  <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                    {(previews[index] as any[] | undefined)?.map((game: any, i: number) => (
                      <div
                        key={game.id}
                        className="relative -ml-6 sm:-ml-8 first:ml-0 hover:z-50 hover:scale-110 transition-transform duration-200"
                        style={{ zIndex: 10 - i }}
                      >
                        <Link to="/$id" params={{ id: game.id }}>
                          <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-lg shadow-lg border-2 border-base-200 overflow-hidden bg-base-300">
                            {game.imageId ? (
                              <img
                                src={getImageUrl({ imageId: game.imageId, width: game.imageWidth, height: game.imageHeight })}
                                alt={game.alias || game.id}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                                {game.alias || game.id}
                              </div>
                            )}
                          </div>
                        </Link>
                      </div>
                    ))}
                  </div>
                  <div
                    className="relative -ml-6 sm:-ml-8 hover:z-50 hover:scale-110 transition-transform duration-200"
                    style={{ zIndex: -10 }}
                  >
                    <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-lg shadow-lg border-2 border-dashed border-base-300 bg-base-200 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                      <span className="text-lg">→</span>
                      <span className="text-[10px] sm:text-xs leading-tight text-center">查看<br/>更多</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            暂无合集
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() =>
              navigate({ to: '/collections', search: { page: page - 1 } })
            }
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() =>
              navigate({ to: '/collections', search: { page: page + 1 } })
            }
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  )
}
