import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@web/components/ui/breadcrumb'
import { Skeleton } from '@web/components/ui/skeleton'
import { getImageUrl } from '@web/lib/image-url'
import { getCollectionById, getCollectionPreview } from '@web/server/collections'
import type { CollectionData, CollectionPreviewGame } from '@web/lib/collections'
import { Library, Layers, ChevronLeft } from 'lucide-react'

export const Route = createFileRoute('/collections/$id')({
  loader: async ({ params }) => {
    const [collection, previews] = await Promise.all([
      getCollectionById({ data: { id: params.id } }),
      getCollectionPreview({ data: { id: params.id, limit: 50 } }).catch(() => []),
    ])
    return { collection, previews }
  },
  headers: ({ params }) => ({
    'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300',
    'Cache-Tag': `collection-${params.id},page-collection-detail`,
  }),
  component: RouteComponent,
  pendingComponent: () => <CollectionDetailSkeleton />,
})

function CollectionDetailSkeleton() {
  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink render={<Link to="/collections" />}>合集</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>...</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="p-6 sm:p-8 space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-9 w-1/2" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-[2/3] rounded-lg w-full" />
            <Skeleton className="h-4 w-3/4 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

function RouteComponent() {
  const { id } = Route.useParams()
  const loaderData = Route.useLoaderData()

  const { data: collection } = useSuspenseQuery({
    queryKey: ['collection', id],
    queryFn: () => getCollectionById({ data: { id } }),
    initialData: loaderData.collection,
  })

  const { data: previews } = useSuspenseQuery({
    queryKey: ['collection-preview', id],
    queryFn: () => getCollectionPreview({ data: { id, limit: 50 } }).catch(() => []),
    initialData: loaderData.previews,
  })

  const coll = collection as CollectionData & { entries?: unknown[] }
  const games = (previews ?? []) as CollectionPreviewGame[]
  const gameCount = coll.entryCount ?? games.length

  // First 4 covers for hero mosaic
  const heroCovers = games.slice(0, 4)

  if (!coll) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center">
        <div className="flex items-center justify-center size-16 rounded-2xl bg-muted/50 mx-auto mb-4">
          <Library className="size-8 text-muted-foreground/40" />
        </div>
        <p className="text-lg font-medium text-foreground/60">合集不存在</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-10">
      {/* Breadcrumb */}
      <Breadcrumb className="mb-2">
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink render={<Link to="/collections" />}>合集</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>{coll.title}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Hero Section */}
      <div className="relative rounded-2xl overflow-hidden border bg-card">
        {/* Cover mosaic backdrop */}
        {heroCovers.length > 0 && (
          <div className="absolute inset-0 grid grid-cols-4 opacity-25 dark:opacity-20">
            {heroCovers.map((game) => (
              <div key={game.id} className="overflow-hidden">
                <img
                  src={getImageUrl({
                    imageId: game.imageId,
                    width: game.imageWidth,
                    height: game.imageHeight,
                  })}
                  alt=""
                  className="w-full h-full object-cover blur-[2px] scale-110"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}

        {/* Gradient overlay — lighter to let mosaic through */}
        <div className="absolute inset-0 bg-gradient-to-br from-card/40 via-card/70 to-card/90" />

        {/* Content */}
        <div className="relative p-6 sm:p-8 md:p-10">
          <div className="flex flex-wrap items-center gap-2.5 mb-4">
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Layers className="size-3.5" />
              {gameCount} 部作品
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-4">
            {coll.title}
          </h1>

          {coll.description && (
            <p className="text-muted-foreground leading-relaxed max-w-2xl text-base">
              {coll.description}
            </p>
          )}
        </div>
      </div>

      {/* Game Grid Section */}
      <section>
        <div className="flex items-baseline gap-3 mb-6">
          <h2 className="text-xl font-semibold">收录作品</h2>
          <span className="text-sm text-muted-foreground">
            共 {gameCount} 部
          </span>
        </div>

        {games.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {games.map((game) => (
              <Link
                key={game.id}
                to="/$id"
                params={{ id: game.id }}
                className="group block rounded-xl overflow-hidden bg-card border transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="aspect-[2/3] overflow-hidden bg-muted">
                  <img
                    src={getImageUrl({
                      imageId: game.imageId,
                      width: game.imageWidth,
                      height: game.imageHeight,
                    })}
                    alt={game.title ?? game.alias ?? game.id}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
                <div className="p-2.5">
                  <p className="text-xs text-center leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {game.title ?? game.alias ?? game.id}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border bg-card/50">
            <div className="flex items-center justify-center size-14 rounded-xl bg-muted/50 mb-3">
              <Library className="size-7 text-muted-foreground/40" />
            </div>
            <p className="text-muted-foreground text-sm">暂无收录作品</p>
          </div>
        )}
      </section>

      {/* Back link */}
      <div className="pt-2">
        <Link
          to="/collections"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ChevronLeft className="size-4" />
          返回合集列表
        </Link>
      </div>
    </div>
  )
}
