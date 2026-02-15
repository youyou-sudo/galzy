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
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">数据管理</h1>
        <p className="text-muted-foreground">
          查看数据统计和管理数据视图，监控系统数据状态
        </p>
      </div>
      <div className="space-y-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <StatsCard />
          <DataTabl />
        </HydrationBoundary>
      </div>
    </div>
  )
}
