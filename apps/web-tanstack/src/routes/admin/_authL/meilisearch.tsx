import { createFileRoute } from '@tanstack/react-router'
import { EmbeddersTab } from '@web/components/admin/meilisearch/embedders-tab'
import { IndexesTab } from '@web/components/admin/meilisearch/indexes-tab'
import { OverviewTab } from '@web/components/admin/meilisearch/overview-tab'
import { PropertiesTab } from '@web/components/admin/meilisearch/properties-tab'
import { SearchableTab } from '@web/components/admin/meilisearch/searchable-tab'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@web/components/ui/tabs'
import {
  BracesIcon,
  DatabaseIcon,
  ListIcon,
  SearchIcon,
  ServerIcon,
} from 'lucide-react'

export const Route = createFileRoute('/admin/_authL/meilisearch')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meilisearch 管理</h1>
        <p className="text-muted-foreground mt-1">
          管理 Meilisearch 搜索引擎的配置与索引
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <div className="overflow-x-auto max-w-full -mb-[5px] pb-[5px]">
          <TabsList variant="line">
            <TabsTrigger value="overview">
              <ServerIcon className="size-4" />
              概览
            </TabsTrigger>
            <TabsTrigger value="embedders">
              <BracesIcon className="size-4" />
              Embedders
            </TabsTrigger>
            <TabsTrigger value="searchable">
              <SearchIcon className="size-4" />
              搜索属性
            </TabsTrigger>
            <TabsTrigger value="properties">
              <ListIcon className="size-4" />
              属性列表
            </TabsTrigger>
            <TabsTrigger value="indexes">
              <DatabaseIcon className="size-4" />
              索引管理
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="embedders" className="mt-4">
          <EmbeddersTab />
        </TabsContent>
        <TabsContent value="searchable" className="mt-4">
          <SearchableTab />
        </TabsContent>
        <TabsContent value="properties" className="mt-4">
          <PropertiesTab />
        </TabsContent>
        <TabsContent value="indexes" className="mt-4">
          <IndexesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
