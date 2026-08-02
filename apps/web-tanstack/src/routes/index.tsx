import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import CountComponent from '@web/components/home/Count'
import {
  CollectionsSection,
  CollectionsSectionSkeleton,
} from '@web/components/home/collections-section'
import { HotGamesSection } from '@web/components/home/hot-games-section'
import { RankingList } from '@web/components/home/remf'
import SearchInput from '@web/components/home/search/Search'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'
import { Skeleton } from '@web/components/ui/skeleton'
import { seoTemplate } from '@web/config/seoTemplate'
import { seoMeta } from '@web/lib/seo'
import { getCollectionsWithPreview } from '@web/server/collections'
import { getCritical, getTotalCount } from '@web/server/game'
import { Gamepad2, Tags } from 'lucide-react'

export const Route = createFileRoute('/')({
  component: App,
  head: () =>
    seoMeta({
      title: seoTemplate.title,
      description: seoTemplate.description,
      path: '/',
    }),
  loader: async ({ context }) => {
    const [rankings] = await Promise.all([
      getCritical(),
      Promise.all([
        context.queryClient.ensureQueryData({
          queryKey: ['homeCollections'],
          queryFn: () =>
            getCollectionsWithPreview({
              data: { limit: 5, previewLimit: 3 },
            }).then((r) => r.items),
        }),
        context.queryClient.ensureQueryData({
          queryKey: ['totalCount'],
          queryFn: () => getTotalCount(),
        }),
      ]),
    ])
    return { rankings }
  },

  pendingComponent: () => <HomePageSkeleton />,
  headers: () => ({
    'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=60',
    'Cache-Tag': 'page-home',
  }),
  staleTime: 60_000,
  gcTime: 5 * 60_000,
})

const apiroute = getRouteApi('/')

function App() {
  const { rankings } = apiroute.useLoaderData()

  return (
    <>
      <h1 className="text-4xl font-semibold text-center mt-10">紫缘社</h1>

      <CountComponent />

      <div className="px-5 sm:px-20 lg:px-80 my-4">
        <SearchInput />
      </div>

      <div className="grid grid-cols-2 gap-2 px-3 mb-6">
        <Card className="border-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-base">
              热门标签 <Tags className="size-4 ml-1 text-rose-400" />
            </CardTitle>
            <CardDescription>每周检索最多标签</CardDescription>
          </CardHeader>
          <CardContent>
            <RankingList linkKey="tag" />
          </CardContent>
        </Card>
        <Card className="border-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-base">
              热门游戏 <Gamepad2 className="size-4 ml-1 text-rose-400" />
            </CardTitle>
            <CardDescription>每周浏览最多游戏</CardDescription>
          </CardHeader>
          <CardContent>
            <RankingList linkKey="id" />
          </CardContent>
        </Card>
      </div>

      <HotGamesSection games={rankings.game} />

      <CollectionsSection />
    </>
  )
}

function HomePageSkeleton() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex justify-center p-6">
        <div className="w-full max-w-2xl flex flex-col gap-6">
          <Skeleton className="h-10 w-3/4 mx-auto" />
          <div className="flex justify-center gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
      <CollectionsSectionSkeleton />
    </div>
  )
}
