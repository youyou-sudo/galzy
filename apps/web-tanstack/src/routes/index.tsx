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
import { getSession } from '@web/server/auth/auth.functions'
import { getCollectionsWithPreview } from '@web/server/collections'
import { getCritical, getGameImages } from '@web/server/game'
import { Gamepad2, Tags } from 'lucide-react'

export const Route = createFileRoute('/')({
  component: App,
  loader: async ({ context }) => {
    const rankings = await getCritical()
    const hotIds = (rankings.game ?? []).slice(0, 12).map((g) => g.id)
    // Prefetch all non-critical data in parallel
    await Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: ['auth'],
        queryFn: getSession,
      }),
      context.queryClient.ensureQueryData({
        queryKey: ['homeCollections'],
        queryFn: () =>
          getCollectionsWithPreview({ data: { limit: 5, previewLimit: 3 } }),
      }),
      context.queryClient.ensureQueryData({
        queryKey: ['hotGameImages', hotIds],
        queryFn: () => getGameImages({ data: { ids: hotIds } }),
      }),
    ])
    return { rankings }
  },

  pendingComponent: () => <HomePageSkeleton />,
  headers: () => ({
    'Cache-Control':
      'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
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
