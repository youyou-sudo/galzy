import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import LoadBalancerDashboard from '@web/components/dashboard/download/load-balancer-dashboard'
import { workerDataGet } from '@web/lib/dashboard/download/Cloudflare/workerDataPull'

export default async function page() {
  const queryClient = new QueryClient()
  await queryClient.prefetchQuery({
    queryKey: ['workersItems'],
    queryFn: async () => {
      const res = await workerDataGet()
      return res
    },
  })
  return (
    <div className="space-y-6">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <LoadBalancerDashboard />
      </HydrationBoundary>
    </div>
  )
}
