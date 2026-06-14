import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge } from '@web/components/ui/badge'
import { Button } from '@web/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'
import { Spinner } from '@web/components/ui/spinner'
import {
  triggerGameIndexRebuild,
  triggerTagIndexRebuild,
} from '@web/server/admin/meilisearch'
import { RefreshCwIcon } from 'lucide-react'
import { toast } from 'sonner'

export function IndexesTab() {
  const queryClient = useQueryClient()

  const rebuildGame = useMutation({
    mutationFn: triggerGameIndexRebuild,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meiliStats'] })
      toast.success('游戏索引重建任务已触发！请稍后在概览中查看进度。')
    },
    onError: (e: Error) => {
      toast.error(e.message ?? '触发失败')
    },
  })

  const rebuildTag = useMutation({
    mutationFn: triggerTagIndexRebuild,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meiliStats'] })
      toast.success('标签索引重建任务已触发！请稍后在概览中查看进度。')
    },
    onError: (e: Error) => {
      toast.error(e.message ?? '触发失败')
    },
  })

  const isRebuilding = rebuildGame.isPending || rebuildTag.isPending

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>索引重建</CardTitle>
          <CardDescription>
            手动触发索引重建。重建操作会清空现有索引并从数据库重新导入所有数据，耗时较长（通常数分钟）。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 p-4 bg-muted/50 rounded-lg space-y-3">
              <div>
                <p className="font-medium">游戏索引</p>
                <p className="text-xs text-muted-foreground mt-1">
                  重建 Galgame 游戏数据的全文搜索索引
                </p>
              </div>
              <Button
                variant="default"
                onClick={() => rebuildGame.mutate}
                disabled={isRebuilding}
              >
                {rebuildGame.isPending ? (
                  <Spinner className="size-4 mr-1" />
                ) : (
                  <RefreshCwIcon className="size-4 mr-1" />
                )}
                重建游戏索引
              </Button>
            </div>

            <div className="flex-1 p-4 bg-muted/50 rounded-lg space-y-3">
              <div>
                <p className="font-medium">标签索引</p>
                <p className="text-xs text-muted-foreground mt-1">
                  重建标签数据的全文搜索索引
                </p>
              </div>
              <Button
                variant="default"
                onClick={() => rebuildTag.mutate}
                disabled={isRebuilding}
              >
                {rebuildTag.isPending ? (
                  <Spinner className="size-4 mr-1" />
                ) : (
                  <RefreshCwIcon className="size-4 mr-1" />
                )}
                重建标签索引
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>定时任务</CardTitle>
          <CardDescription>Meilisearch 索引相关的自动任务</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Cron</Badge>
              <span>游戏索引自动重建 — 每 12 小时</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Cron</Badge>
              <span>标签索引自动重建 — 每 12 小时</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
