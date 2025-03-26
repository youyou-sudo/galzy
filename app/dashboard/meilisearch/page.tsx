import {
  getIndexList,
  meilliTasksList,
} from "../../../lib/meilisearch/indexGet";
import MeiliConfig from "@/components/dashboard/meilisearch/MeiliConfig";
import IndexCard from "@/components/dashboard/meilisearch/IndexCard";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { meiliconfigGet } from "@/lib/meilisearch/upmeili";
import TaskeListCard from "@/components/dashboard/meilisearch/taskeList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function VndbDatasPage() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["meiliData"],
    queryFn: async () => meiliconfigGet(),
  });
  await queryClient.prefetchQuery({
    queryKey: ["IndexData"],
    queryFn: async () => getIndexList(),
  });
  await queryClient.prefetchQuery({
    queryKey: ["meiliTasksList"],
    queryFn: async () => meilliTasksList(),
  });
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-4">
        <div className="break-inside-avoid">
          <MeiliConfig />
        </div>
        <div className="break-inside-avoid">
          <IndexCard />
        </div>
        <Tabs defaultValue="Task">
          <TabsList>
            <TabsTrigger value="Task">Task</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
          </TabsList>
          <TabsContent value="Task">
            <div className="break-inside-avoid">
              <TaskeListCard />
            </div>
          </TabsContent>
          <TabsContent value="password">Change your password here.</TabsContent>
        </Tabs>
      </div>
    </HydrationBoundary>
  );
}
