import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getMeiliSearchClient } from "@/lib/meilisearch";
import { env } from "next-runtime-env";
import { formatBytes } from "@/lib/formatBytes";

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  TabsContents,
} from "@/components/animate-ui/radix/tabs";

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { MeiliSearchEmbedding } from "./MeiliSearchEmbedding";
import { MeiliSearchIndex } from "./MeilisearchIndex";

export const MeiliSearch = () => {
  return (
    <div>
      {/* [x] 后台 Meilsearch 配置项
      [x] Meilsearch 索引
      [x] Meilsearch 矢量嵌入
       */}

      <Card>
        <CardHeader>
          <CardTitle>MeiliSearch 配置</CardTitle>
          <CardDescription>
            <Suspense
              fallback={<Skeleton className="h-[20px] w-full max-w-[300px]" />}
            >
              <DocumentsCounter />
            </Suspense>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="Index">
            <TabsList>
              <TabsTrigger value="Index">索引</TabsTrigger>
              <TabsTrigger value="Embedding">矢量嵌入</TabsTrigger>
            </TabsList>
            <TabsContents>
              <TabsContent value="Index">
                <MeiliSearchIndex />
              </TabsContent>
              <TabsContent value="Embedding">
                <MeiliSearchEmbedding />
              </TabsContent>
            </TabsContents>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

const DocumentsCounter = async () => {
  let indexdata;
  const indexName = env("MEILISEARCH_INDEXNAME")!;
  try {
    const meiliClient = await getMeiliSearchClient();
    indexdata = await meiliClient.getStats();
  } catch {
    return <>MeiliSearch</>;
  }

  return (
    <>
      MeiliSearch
      {indexdata
        ? ` 大小：${formatBytes(indexdata.databaseSize)} | ${
            indexdata.indexes[indexName].numberOfDocuments
          } 条索引`
        : ""}
    </>
  );
};
