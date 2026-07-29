import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card';
import { Separator } from '@web/components/ui/separator';
import { getMeiliStats } from '@web/server/admin/meilisearch';
import {
  ClockIcon,
  DatabaseIcon,
  FileTextIcon,
  HardDriveIcon,
} from 'lucide-react';
import type { MeiliStats } from './types';
import {
  CardSkeleton,
  EmptyState,
  ErrorDisplay,
  extractError,
  formatBytes,
  formatNumber,
  formatTime,
  ignoreAbort,
  indexIcon,
  relativeTime,
  StatCard,
  StatSkeleton,
  StatusBadge,
} from './shared';

export function OverviewTab() {
  const {
    data: raw,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['meiliStats'],
    queryFn: ignoreAbort(getMeiliStats),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <StatSkeleton />
          </CardContent>
        </Card>
        <Card>
          <CardSkeleton rows={2} />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <ErrorDisplay
            message={extractError(error)}
            onRetry={() => refetch()}
          />
        </CardContent>
      </Card>
    );
  }

  const stats = raw as MeiliStats | undefined;
  if (!stats) return null;

  const indexes = stats.indexes ?? {};
  const indexEntries = Object.entries(indexes);
  const totalDocs = indexEntries.reduce(
    (sum, [, idx]) => sum + (idx.numberOfDocuments ?? 0),
    0,
  );
  const indexingCount = indexEntries.filter(
    ([, idx]) => idx.isIndexing,
  ).length;

  return (
    <div className="space-y-6">
      {/* Hero Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={HardDriveIcon}
          label="数据库大小"
          value={formatBytes(stats.databaseSize)}
        />
        <StatCard
          icon={FileTextIcon}
          label="总文档数"
          value={formatNumber(totalDocs)}
          description={
            indexingCount > 0 ? `${indexingCount} 个索引进行中` : undefined
          }
        />
        <StatCard
          icon={DatabaseIcon}
          label="索引数量"
          value={indexEntries.length}
          description={
            indexEntries.length > 0
              ? `${indexEntries.filter(([, i]) => i.numberOfDocuments > 0).length} 个有数据`
              : undefined
          }
        />
        <StatCard
          icon={ClockIcon}
          label="最后更新"
          value={relativeTime(stats.lastUpdate) || '-'}
          description={stats.lastUpdate ? formatTime(stats.lastUpdate) : undefined}
        />
      </div>

      {/* Index Detail Cards */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">索引详情</CardTitle>
          <CardDescription>
            各索引的文档数、字段分布与运行状态
          </CardDescription>
        </CardHeader>
        <CardContent>
          {indexEntries.length === 0 ? (
            <EmptyState
              icon={DatabaseIcon}
              text="暂无索引数据"
              description="Meilisearch 实例中尚未创建任何索引"
            />
          ) : (
            <div className="space-y-2">
              {indexEntries.map(([name, idx], i) => {
                const Icon = indexIcon(name);
                const fieldCount = Object.keys(
                  idx.fieldDistribution ?? {},
                ).length;
                return (
                  <div key={name}>
                    {i > 0 && <Separator className="my-2" />}
                    <div className="flex items-center justify-between gap-4 py-1">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex items-center justify-center size-9 rounded-lg bg-muted/50 shrink-0">
                          <Icon className="size-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatNumber(idx.numberOfDocuments)} 文档
                            {fieldCount > 0 && ` · ${fieldCount} 字段`}
                          </p>
                        </div>
                      </div>
                      <StatusBadge
                        status={idx.isIndexing ? 'running' : 'idle'}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
