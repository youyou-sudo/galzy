import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CollectionCard } from '@web/components/collections/collection-card'
import { Button } from '@web/components/ui/button'
import { getCollectionPreview, getCollections } from '@web/server/collections'
import { Package } from 'lucide-react'

export const Route = createFileRoute('/collections/')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    page: Number(search.page ?? 1),
  }),
  loaderDeps: ({ search: { page } }) => ({ page }),
  loader: async ({ deps: { page } }) => {
    const data = await getCollections({ data: { page, limit: 10 } })
    const items = (data as any).items ?? []
    const previews = await Promise.all(
      items.map((c: any) =>
        getCollectionPreview({ data: { id: String(c.id), limit: 10 } }).catch(
          () => [],
        ),
      ),
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
      const data = await getCollections({ data: { page, limit: 10 } })
      const items = (data as any).items ?? []
      const previews = await Promise.all(
        items.map((c: any) =>
          getCollectionPreview({ data: { id: String(c.id), limit: 10 } }).catch(
            () => [],
          ),
        ),
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

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-6 px-4 sm:px-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="size-6" />
          <h1 className="text-2xl font-bold">合集</h1>
        </div>
        <span className="text-sm text-muted-foreground">共 {total} 个合集</span>
      </div>

      <div className="flex flex-col gap-4">
        {items.map((collection: any, index: number) => (
          <CollectionCard
            key={collection.id}
            collection={collection}
            previews={(previews[index] as any[]) ?? []}
            totalCount={collection.entryCount ?? (previews[index] as any[])?.length ?? 0}
          />
        ))}
        {items.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-12">
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
