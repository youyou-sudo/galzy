import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@web/components/ui/breadcrumb'
import { Card, CardContent, CardHeader } from '@web/components/ui/card'
import { getImageUrl } from '@web/lib/image-url'
import {
  getCollectionById,
  getCollectionPreview,
} from '@web/server/collections'
import { Loader2Icon, Package } from 'lucide-react'

export const Route = createFileRoute('/collections/$id')({
  component: RouteComponent,
  loader: async ({ params }) => {
    const [collection, previews] = await Promise.all([
      getCollectionById({ data: { id: params.id } }),
      getCollectionPreview({ data: { id: params.id, limit: 50 } }).catch(
        () => [],
      ),
    ])
    return { collection, previews }
  },
})

function RouteComponent() {
  const { id } = Route.useParams()
  const loaderData = Route.useLoaderData()
  const { data: collection, isLoading } = useQuery({
    queryKey: ['collection', id],
    queryFn: async () => await getCollectionById({ data: { id } }),
    initialData: loaderData.collection,
  })
  const { data: previews } = useQuery({
    queryKey: ['collection-preview', id],
    queryFn: async () =>
      await getCollectionPreview({ data: { id, limit: 50 } }).catch(() => []),
    initialData: loaderData.previews,
  })

  const coll = collection as any
  const games = (previews ?? []) as any[]

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-12 flex items-center justify-center">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!coll) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center text-muted-foreground">
        合集不存在
      </div>
    )
  }


  return (
    <div className="max-w-4xl mx-auto space-y-6 py-6 px-4 sm:px-0">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink render={<Link to="/collections" />}>合集</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>{coll.title}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="size-5 text-muted-foreground" />
            <h1 className="text-2xl font-bold">{coll.title}</h1>
          </div>
          {coll.description && (
            <p className="text-muted-foreground mt-2">{coll.description}</p>
          )}
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">
            游戏列表
            {games.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                共 {games.length} 部
              </span>
            )}
          </h2>
        </CardHeader>
        <CardContent>
          {games.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {games.map((game: any) => (
                <Link
                  key={game.id}
                  to="/$id"
                  params={{ id: game.id }}
                  className="group block"
                >
                  <div className="aspect-[9/13] rounded-lg overflow-hidden bg-base-300 shadow-md group-hover:shadow-lg transition-shadow">
                    {game.imageId ? (
                      <img
                        src={getImageUrl({
                          imageId: game.imageId,
                          width: game.imageWidth,
                          height: game.imageHeight,
                        })}
                        alt={game.title || game.alias || game.id}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                        {game.title || game.alias || game.id}
                      </div>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm truncate group-hover:text-blue-500 transition-colors">
                    {game.title || game.alias || game.id}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              暂无游戏
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
