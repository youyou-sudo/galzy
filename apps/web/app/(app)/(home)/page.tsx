import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { homeData } from '@web/app/(app)/(home)/(action)/homeData'
import { HomeGamelist } from '@web/components/home'
import SearchInput from '@web/components/home/Search/Search'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'
import { Skeleton } from '@web/components/ui/skeleton'
import { metadataConfig } from '@web/config/metadata'
import { Gamepad2, Tags } from 'lucide-react'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { remfGameGet, remfTagGet } from './(action)/remf'
import CountComponent from './(components)/Count'
import RankingList from './(components)/remf'

export const metadata: Metadata = {
  title: '主页',
  description: metadataConfig.description,
}

// 提取 Skeleton 列表，避免重复
const SkeletonList = ({ count = 4 }: { count?: number }) => (
  <>
    {Array.from({ length: count }).map((_, index) => (
      <Skeleton key={index} className="h-[21px] w-full my-2.5" />
    ))}
  </>
)

type HomeDataResult = Awaited<ReturnType<typeof homeData>>

const HomePage = async () => {
  const queryClient = new QueryClient()
  await queryClient.prefetchInfiniteQuery({
    queryKey: ['gamelist'],
    queryFn: async ({ pageParam }) => {
      const data = await homeData(24, pageParam)
      if (!data) {
        return null
      }
      return data
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: HomeDataResult) =>
      lastPage && lastPage.currentPage < lastPage.totalPages
        ? lastPage.currentPage + 1
        : null,
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomeGamelist />
    </HydrationBoundary>
  )
}

const Home = () => {
  return (
    <>
      <h1 className="text-4xl font-bold text-center mt-10">紫缘社</h1>
      <div className="mx-auto">
        <CountComponent />
      </div>
      {/* 搜索框 */}
      <div className="min-w-4/5 md:min-w-2/4 mx-auto">
        <SearchInput />
      </div>

      {/* 热门标签 + 热门游戏 */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-2 px-0 md:px-3">
        <Card className="gap-3 border-0">
          <CardHeader>
            <CardTitle className="flex items-center">
              热门标签 <Tags className="w-4 h-4 ml-1 text-red-300" />
            </CardTitle>
            <CardDescription>每周检索最多标签</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<SkeletonList />}>
              <RankingList fetchData={remfTagGet} linkKey="tag" />
            </Suspense>
          </CardContent>
        </Card>

        <Card className="gap-3 border-0">
          <CardHeader>
            <CardTitle className="flex items-center">
              热门游戏 <Gamepad2 className="w-4 h-4 ml-1 text-red-300" />
            </CardTitle>
            <CardDescription>每周浏览最多游戏</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<SkeletonList />}>
              <RankingList fetchData={remfGameGet} linkKey="id" />
            </Suspense>
          </CardContent>
        </Card>
      </div>

      {/* 游戏列表 */}
      <div>
        <HomePage />
      </div>
    </>
  )
}

export default Home
