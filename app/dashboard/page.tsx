import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { coutAcQ, dataUpQ } from "./(action)/dataAc";
import { DataDashboardPage } from "./(components)/dataDashboardPage";

export default async function Page() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["dashListData"],
    queryFn: () => dataUpQ(),
  });
  await queryClient.prefetchQuery({
    queryKey: ["dashListCountData"],
    queryFn: () => coutAcQ(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DataDashboardPage />
    </HydrationBoundary>
  );
}
