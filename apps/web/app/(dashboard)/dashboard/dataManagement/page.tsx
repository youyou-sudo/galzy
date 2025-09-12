import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import DataTabl from '@web/components/dashboard/dataManagement/dataTabl'
import StatsCard from '@web/components/dashboard/dataManagement/StatsCard'
import {
  dataFilteringGet,
  dataFilteringStats,
} from '@web/lib/dashboard/dataManagement/dataGet'

export default async function page() {
  const queryClient = new QueryClient()

  // 数据视图数据总数
  await queryClient.prefetchQuery({
    queryKey: ['dataFilteringStats'],
    queryFn: async () => {
      const res = await dataFilteringStats()
      return res
    },
  })

  // 数据筛选列表请求
  await queryClient.prefetchQuery({
    queryKey: ['dataFilteringGet'],
    queryFn: async () => {
      const res = await dataFilteringGet()
      return res
    },
  })
  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between p-6">
          <div>
            <h1 className="text-3xl font-bold">数据视图</h1>
            <p className="mt-1 opacity-50">此页面用于数据总数观察</p>
          </div>
        </div>
        <div className="space-y-3">
          <HydrationBoundary state={dehydrate(queryClient)}>
            <StatsCard />
            <DataTabl />
          </HydrationBoundary>
        </div>
      </div>
    </div>
  )
}
