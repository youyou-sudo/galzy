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
import { GameItem } from '@web/components/home/GameItem'

export const metadata: Metadata = {
  title: '主页',
  description: metadataConfig.description,
}

const SkeletonList = ({ count = 4 }: { count?: number }) => (
  <>
    {Array.from({ length: count }).map((_, index) => (
      <Skeleton key={index} className="h-[21px] w-full my-2.5" />
    ))}
  </>
)


const HomePage = async () => {
  const data = await homeData(24, 0)
  return (
    <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
      {data?.items?.map((item) => (
        <GameItem key={item.id} item={item} />
      ))}
      <HomeGamelist />
    </div>
  )
}

const Home = () => {
  return (
    <>
      <article>
        <h1 className="text-4xl font-bold text-center mt-10">紫缘社</h1>
        <div className="mx-auto">
          <CountComponent />
        </div>
        {/* 搜索框 */}
        <div className="px-5 sm:px-20 lg:px-80 my-4">
          <SearchInput />
        </div>

        {/* 热门标签 + 热门游戏 */}
        <div className="grid grid-cols-2 md:grid-cols-2 gap-2 px-0 md:px-3 mb-0">
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
      </article>
      {/* 广告 */}
      {/* <aside id="sidebar-ad" className='opacity-80 lg:px-24 px-4 my-4' >
        <AspectRatio ratio={120 / 9}>
          <Image src="/aifywebp.webp" fill alt="AI 风月广告图片" className="object-cover rounded-lg" />
        </AspectRatio>
      </aside > */}
      {/* 游戏列表 */}
      <article className="mt-4">
        <HomePage />
      </article>
    </>
  )
}

export default Home
