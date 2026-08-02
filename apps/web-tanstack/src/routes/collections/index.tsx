import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  CollectionCard,
  CollectionCardSkeleton,
} from '@web/components/collections/collection-card'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@web/components/ui/breadcrumb'
import { Button } from '@web/components/ui/button'
import { seoTemplate } from '@web/config/seoTemplate'
import { seoMeta } from '@web/lib/seo'
import { getCollectionsWithPreview } from '@web/server/collections'
import { ChevronLeft, ChevronRight, Library, Package } from 'lucide-react'
import { z } from 'zod'

const searchSchema = z.object({
  page: z.optional(z.number().default(1)).catch(1),
})

export const Route = createFileRoute('/collections/')({
  head: () =>
    seoMeta({
      title: `游戏合集 | ${seoTemplate.title}`,
      description:
        'GalZY 精选游戏合集：官方中文、经典名作、会社作品集等主题合集，一次发现更多好游戏。',
      path: '/collections',
    }),
  validateSearch: searchSchema,
  loaderDeps: ({ search: { page } }) => ({ page }),
  loader: async ({ deps: { page } }) => {
    return getCollectionsWithPreview({
      data: { page, limit: 30, previewLimit: 4 },
    })
  },
  headers: () => ({
    'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300',
    'Cache-Tag': 'page-collections',
  }),
  component: RouteComponent,
  pendingComponent: () => <CollectionsPageSkeleton />,
})

function CollectionsPageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>合集</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-3 mb-6">
        <div className="size-10 rounded-xl bg-muted animate-pulse" />
        <div className="h-8 w-32 rounded bg-muted animate-pulse" />
      </div>

      <div className="mb-4 h-5 w-24 rounded bg-muted animate-pulse" />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <CollectionCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

function RouteComponent() {
  const { page } = Route.useSearch()
  const initialData = Route.useLoaderData()

  const { data: result } = useSuspenseQuery({
    queryKey: ['collections', page],
    queryFn: () =>
      getCollectionsWithPreview({ data: { page, limit: 30, previewLimit: 4 } }),
    initialData,
    staleTime: 5 * 60_000,
  })

  const items = result?.items ?? []
  const total = Number(result?.total ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / (result?.limit ?? 30)))

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
      {/* Breadcrumb */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>合集</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Hero Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center size-10 rounded-xl bg-primary/10">
            <Library className="size-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">精选合集</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          共 <span className="font-medium text-foreground">{total}</span> 个合集
        </p>
      </div>

      {/* Grid */}
      {items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((col) => (
            <CollectionCard key={col.id} collection={col} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex items-center justify-center size-16 rounded-2xl bg-muted/50 mb-4">
            <Package className="size-8 text-muted-foreground/40" />
          </div>
          <p className="text-lg font-medium text-foreground/60">暂无合集</p>
          <p className="text-sm text-muted-foreground mt-1">
            还没有创建任何合集
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-10">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            render={
              page > 1 ? (
                <Link to="/collections" search={{ page: page - 1 }} />
              ) : undefined
            }
          >
            <ChevronLeft className="size-4" />
            上一页
          </Button>

          <div className="flex items-center gap-1">
            {paginationRange(page, totalPages).map((p, i) =>
              p === '…' ? (
                <span
                  key={`dots-${i}`}
                  className="px-1 text-muted-foreground text-sm"
                >
                  …
                </span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="sm"
                  className="min-w-9 px-2"
                  render={<Link to="/collections" search={{ page: p }} />}
                >
                  {p}
                </Button>
              ),
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            render={
              page < totalPages ? (
                <Link to="/collections" search={{ page: page + 1 }} />
              ) : undefined
            }
          >
            下一页
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

/** Generate a compact page range: [1, …, 4, 5, 6, …, 10] */
function paginationRange(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  if (current <= 3) return [1, 2, 3, 4, '…', total]
  if (current >= total - 2)
    return [1, '…', total - 3, total - 2, total - 1, total]
  return [1, '…', current - 1, current, current + 1, '…', total]
}
