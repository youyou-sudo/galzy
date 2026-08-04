import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { EmbeddersTab } from '@web/components/admin/meilisearch/embedders-tab';
import { IndexesTab } from '@web/components/admin/meilisearch/indexes-tab';
import { OverviewTab } from '@web/components/admin/meilisearch/overview-tab';
import { PropertiesTab } from '@web/components/admin/meilisearch/properties-tab';
import { SearchableTab } from '@web/components/admin/meilisearch/searchable-tab';
import type { IndexType } from '@web/components/admin/meilisearch/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@web/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@web/components/ui/tabs';
import {
  BracesIcon,
  DatabaseIcon,
  ListIcon,
  SearchIcon,
  ServerIcon,
} from 'lucide-react';
import { z } from 'zod';

const indexTypeSchema = z.object({
  indexType: z.enum(['game', 'tag', 'producer']).optional().default('game'),
});

export const Route = createFileRoute('/admin/_authL/meilisearch')({
  component: RouteComponent,
  validateSearch: indexTypeSchema,
});

function RouteComponent() {

  const { indexType } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Meilisearch 管理
          </h1>
          <p className="text-muted-foreground mt-1">
            管理 Meilisearch 搜索引擎的配置与索引
          </p>
        </div>

        <Select
          value={indexType}
          onValueChange={(v) =>
            navigate({ search: { indexType: v as IndexType } })
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="game">游戏索引</SelectItem>
            <SelectItem value="tag">标签索引</SelectItem>
            <SelectItem value="producer">厂商索引</SelectItem>
          </SelectContent>
        </Select>
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
          <SearchableTab indexType={indexType} />
        </TabsContent>
        <TabsContent value="properties" className="mt-4">
          <PropertiesTab indexType={indexType} />
        </TabsContent>
        <TabsContent value="indexes" className="mt-4">
          <IndexesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
