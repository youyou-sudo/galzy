import { useQuery } from '@tanstack/react-query'
import { Badge } from '@web/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'
import { getMeiliStats } from '@web/server/admin/meilisearch'
import { ErrorDisplay, formatBytes, ignoreAbort, LoadingSpinner, StatItem } from './shared'

export function OverviewTab() {
  const {
    data,
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['meiliStats'],
    queryFn: ignoreAbort(getMeiliStats),
  })

  const errMsg = error && error instanceof Error ? error.message : '加载失败'

  if (loading) return <LoadingSpinner text="正在获取统计信息..." />
  if (error) return <ErrorDisplay message={errMsg} onRetry={() => refetch()} />
  if (!data) return null

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>实例统计</CardTitle>
          <CardDescription>Meilisearch 实例整体运行状态</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatItem
              label="数据库大小"
              value={formatBytes(data.databaseSize)}
            />
            <StatItem
              label="最后更新"
              value={
                data.lastUpdate
                  ? new Date(data.lastUpdate).toLocaleString()
                  : '-'
              }
            />
            <StatItem
              label="索引数量"
              value={Object.keys(data.indexes ?? {}).length}
            />
            <StatItem
              label="总文档数"
              value={Object.values(data.indexes ?? {}).reduce(
                (sum: number, idx: any) => sum + (idx.numberOfDocuments ?? 0),
                0,
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>索引详情</CardTitle>
          <CardDescription>各索引的文档数与字段分布</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(data.indexes ?? {}).map(
              ([name, idx]: [string, any]) => (
                <div
                  key={name}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {idx.numberOfDocuments ?? 0} 文档
                      {idx.isIndexing ? ' · 正在索引中' : ''}
                    </p>
                  </div>
                  <Badge variant={idx.isIndexing ? 'default' : 'secondary'}>
                    {idx.isIndexing ? '索引中' : '就绪'}
                  </Badge>
                </div>
              ),
            )}
            {Object.keys(data.indexes ?? {}).length === 0 && (
              <p className="text-muted-foreground text-center py-4">
                暂无索引数据
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
