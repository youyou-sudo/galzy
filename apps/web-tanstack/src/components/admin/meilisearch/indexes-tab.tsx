import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge } from '@web/components/ui/badge'
import { Button } from '@web/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'
import { Progress } from '@web/components/ui/progress'
import {
  getMeiliSearchProgress,
  triggerGameIndexRebuild,
  triggerTagIndexRebuild,
} from '@web/server/admin/meilisearch'
import { cn } from '@web/lib/utils'
import {
  AlertCircleIcon,
  CheckCircleIcon,
  Loader2Icon,
  PlayIcon,
  RadioIcon,
  RefreshCwIcon,
  XCircleIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const statusConfig = {
  idle: { label: '空闲', variant: 'secondary' as const, icon: null },
  running: { label: '运行中', variant: 'default' as const, icon: Loader2Icon },
  completed: {
    label: '已完成',
    variant: 'default' as const,
    icon: CheckCircleIcon,
  },
  failed: { label: '失败', variant: 'destructive' as const, icon: XCircleIcon },
}

const logLevelConfig: Record<
  string,
  { icon: typeof CheckCircleIcon | null; className: string }
> = {
  info: { icon: null, className: 'text-muted-foreground' },
  success: { icon: CheckCircleIcon, className: 'text-green-600' },
  error: { icon: AlertCircleIcon, className: 'text-red-600' },
}

function RebuildProgressCard({
  type,
  label,
  description,
}: {
  type: 'game' | 'tag'
  label: string
  description: string
}) {
  const logsRef = useRef<HTMLDivElement>(null)
  const forcePollRef = useRef(0)
  const [lastUpdated, setLastUpdated] = useState(0)

  const { data: progress, isLoading } = useQuery({
    queryKey: ['admin', 'meiliSearchProgress', type],
    queryFn: () => getMeiliSearchProgress({ data: { type } }),
    refetchInterval: (query) => {
      if (forcePollRef.current > 0) {
        forcePollRef.current--
        return 2000
      }
      const data = query.state.data
      if (data && data.status === 'running') return 2000
      return false
    },
    onSuccess: () => setLastUpdated(Date.now()),
  })

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight
    }
  }, [progress?.logs.length])

  const isRunning = progress?.status === 'running'
  const status = statusConfig[progress?.status ?? 'idle']
  const progressPercent =
    progress && progress.totalPages > 0
      ? Math.round((progress.processedPages / progress.totalPages) * 100)
      : 0

  return (
    <div className="p-4 bg-muted/50 rounded-lg space-y-3">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>

      {progress && progress.status !== 'idle' ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant={status.variant}>
              {status.icon && (
                <status.icon
                  className={cn('size-3 mr-1', isRunning && 'animate-spin')}
                />
              )}
              {status.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {progress.processedPages}/{progress.totalPages} 页
            </span>
          </div>

          <Progress value={progressPercent} />

          {progress.startedAt && (
            <p className="text-xs text-muted-foreground">
              开始: {new Date(progress.startedAt).toLocaleString()}
              {progress.completedAt &&
                ` · 完成: ${new Date(progress.completedAt).toLocaleString()}`}
            </p>
          )}

          {progress.logs && progress.logs.length > 0 && (
            <div
              ref={logsRef}
              className="bg-muted rounded p-2 max-h-32 overflow-y-auto font-mono text-xs space-y-0.5"
            >
              {progress.logs.map((log, i) => {
                const cfg = logLevelConfig[log.level]
                const Icon = cfg.icon
                return (
                  <div key={i} className={cfg.className}>
                    <span className="text-muted-foreground/60">
                      {new Date(log.time).toLocaleTimeString()}
                    </span>{' '}
                    {Icon && <Icon className="size-3 inline mr-0.5" />}
                    {log.message}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">暂无重建记录</p>
      )}
    </div>
  )
}

export function IndexesTab() {
  const queryClient = useQueryClient()

  const rebuildGame = useMutation({
    mutationFn: triggerGameIndexRebuild,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meiliStats'] })
      queryClient.invalidateQueries({
        queryKey: ['admin', 'meiliSearchProgress', 'game'],
      })
    },
    onError: (e: Error) => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'meiliSearchProgress', 'game'],
      })
    },
  })

  const rebuildTag = useMutation({
    mutationFn: triggerTagIndexRebuild,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meiliStats'] })
      queryClient.invalidateQueries({
        queryKey: ['admin', 'meiliSearchProgress', 'tag'],
      })
    },
    onError: (e: Error) => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'meiliSearchProgress', 'tag'],
      })
    },
  })

  const isRebuilding = rebuildGame.isPending || rebuildTag.isPending

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>索引重建</CardTitle>
          <CardDescription>
            手动触发索引重建。重建操作会清空现有索引并从数据库重新导入所有数据，耗时较长（通常数分钟）。触发后可实时监控进度。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-3">
              <RebuildProgressCard
                type="game"
                label="游戏索引"
                description="重建 Galgame 游戏数据的全文搜索索引"
              />
              <Button
                variant="default"
                onClick={() => {
                  rebuildGame.mutate()
                }}
                disabled={isRebuilding}
                className="w-full"
              >
                {rebuildGame.isPending ? (
                  <Loader2Icon className="size-4 mr-1 animate-spin" />
                ) : (
                  <RefreshCwIcon className="size-4 mr-1" />
                )}
                重建游戏索引
              </Button>
            </div>

            <div className="flex-1 space-y-3">
              <RebuildProgressCard
                type="tag"
                label="标签索引"
                description="重建标签数据的全文搜索索引"
              />
              <Button
                variant="default"
                onClick={() => {
                  rebuildTag.mutate()
                }}
                disabled={isRebuilding}
                className="w-full"
              >
                {rebuildTag.isPending ? (
                  <Loader2Icon className="size-4 mr-1 animate-spin" />
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
