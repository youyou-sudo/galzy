import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'
import { Skeleton } from '@web/components/ui/skeleton'
import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
} from '@web/components/animate-ui/radix/tabs'
import { Suspense } from 'react'
import { MeiliSearchEmbedding } from './MeiliSearchEmbedding'
import { MeiliSearchIndex } from './MeilisearchIndex'
import { api } from '@libs'
import { env } from 'next-runtime-env'
import { formatBytes } from '@web/lib/formatBytes'

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
  )
}

const DocumentsCounter = async () => {

  const { data: indexdata } = await api.search.getStats.get()

  return (
    <>
      MeiliSearch
      {indexdata
        ? ` 大小：${formatBytes(indexdata?.indexes?.[env("MEILISEARCH_INDEXNAME")!].avgDocumentSize)} | ${indexdata?.indexes?.[env("MEILISEARCH_INDEXNAME")!].numberOfDocuments
        } 条索引`
        : ''}
    </>
  )
}
