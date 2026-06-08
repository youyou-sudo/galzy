import { createFileRoute } from '@tanstack/react-router'
import CountComponent from '@web/components/home/Count'
import HomeGamelist from '@web/components/home/homeGameList'
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
import { getCritical, getGameList } from '@web/server/game'
import { Gamepad2, Tags } from 'lucide-react'

export const Route = createFileRoute('/')({
  component: App,
  loader: async () => {
    const [gamelist, rankings] = await Promise.all([
      getGameList(),
      getCritical(),
    ])
    return { gamelist, rankings }
  },

  pendingComponent: () => <HomePageSkeleton />,
  // Client-side caching (via TanStack Router)
  headers: () => ({
    // Cache at CDN for 1 hour, allow stale content for up to 1 day
    'Cache-Control':
      'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
  }),
  staleTime: 60_000, // Consider data fresh for 60 seconds on client
  gcTime: 5 * 60_000, // Keep in memory for 5 minutes
})

function App() {
  return (
    <>
      <h1 className="text-4xl font-semibold text-center mt-10">紫缘社</h1>

      <CountComponent />

      <HanderComp />

      <HomeGamelist />
    </>
  )
}

const HanderComp = () => {
  return (
    <>
      {/* 搜索框 */}
      <div className="px-5 sm:px-20 lg:px-80 my-4">
        <SearchInput />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-2 gap-2 px-0 md:px-3 mb-0">
        <section>
          <Card className="gap-3 border-0">
            <CardHeader>
              <CardTitle className="flex items-center">
                热门标签 <Tags className="size-4 ml-1 text-red-300" />
              </CardTitle>
              <CardDescription>每周检索最多标签</CardDescription>
            </CardHeader>
            <CardContent>
              <RankingList linkKey="tag" />
            </CardContent>
          </Card>
        </section>
        <section>
          <Card className="gap-3 border-0">
            <CardHeader>
              <CardTitle className="flex items-center">
                热门游戏 <Gamepad2 className="size-4 ml-1 text-red-300" />
              </CardTitle>
              <CardDescription>每周浏览最多游戏</CardDescription>
            </CardHeader>
            <CardContent>
              <RankingList linkKey="id" />
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  )
}

function HomePageSkeleton() {
  return (
    <div className="min-h-screen flex justify-center p-6">
      <div className="w-full max-w-2xl space-y-6">
        {/* 标题 */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-8 w-2/3 mx-auto" />
        </div>

        {/* meta */}
        <div className="flex justify-center gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>

        {/* 封面 */}
        <Skeleton className="h-64 w-full rounded-xl" />

        {/* 正文 */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6 mx-auto" />
          <Skeleton className="h-4 w-11/12 mx-auto" />
          <Skeleton className="h-4 w-4/5 mx-auto" />
        </div>
      </div>
    </div>
  )
}
