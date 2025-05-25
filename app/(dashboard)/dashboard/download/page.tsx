import LoadBalancerDashboard from "@/components/dashboard/sedebar/download/load-balancer-dashboard";
import React from "react";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { workerDataGet } from "@/lib/dashboard/download/Cloudflare/workerDataPull";

export default async function page() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["workersItems"],
    queryFn: async () => {
      const res = await workerDataGet();
      return res;
    },
  });
  return (
    <div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <LoadBalancerDashboard />
      </HydrationBoundary>
    </div>
  );
}
