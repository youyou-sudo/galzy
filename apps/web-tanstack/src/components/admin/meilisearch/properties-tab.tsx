import { useQuery } from '@tanstack/react-query'
import { Badge } from '@web/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'
import { getPropertyList } from '@web/server/admin/meilisearch'
import { ErrorDisplay, ignoreAbort, LoadingSpinner } from './shared'

export function PropertiesTab() {
  const {
    data,
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['meiliProperties'],
    queryFn: ignoreAbort(getPropertyList),
  })

  const list = Array.isArray(data) ? data : []

  if (loading) return <LoadingSpinner text="正在加载属性列表..." />
  if (error) {
    const msg = error instanceof Error ? error.message : '加载失败'
    return <ErrorDisplay message={msg} onRetry={() => refetch()} />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>属性列表</CardTitle>
        <CardDescription>
          索引中文档的所有可用属性字段（通过获取一篇示例文档提取）
        </CardDescription>
      </CardHeader>
      <CardContent>
        {list.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {list.map((prop) => (
              <Badge
                key={prop}
                variant="secondary"
                className="font-mono text-xs"
              >
                {prop}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-4">暂无属性数据</p>
        )}
      </CardContent>
    </Card>
  )
}
