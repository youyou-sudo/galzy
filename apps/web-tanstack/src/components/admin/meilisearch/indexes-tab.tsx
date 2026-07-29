import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@web/components/ui/alert-dialog'
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
import { Separator } from '@web/components/ui/separator'
import { cn } from '@web/lib/utils'
import {
  getMeiliSearchProgress,
  triggerGameIndexRebuild,
  triggerTagIndexRebuild,
} from '@web/server/admin/meilisearch'
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  Loader2Icon,
  RefreshCwIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  CardSkeleton,
  ErrorDisplay,
  extractError,
  formatTime,
  ignoreAbort,
  SectionHeader,
  StatusBadge,
} from './shared'
import type { IndexType, MeiliLogEntry, MeiliProgress } from './types'

// ─── Log Level Config ─────────────────────────────────────────

const logLevelConfig: Record<
  MeiliLogEntry['level'],
  {
    icon: typeof CheckCircleIcon | typeof AlertTriangleIcon | null
    className: string
  }
> = {
  info: { icon: null, className: 'text-muted-foreground' },
  success: {
    icon: CheckCircleIcon,
    className: 'text-green-600 dark:text-green-400',
  },
  error: {
    icon: AlertTriangleIcon,
    className: 'text-red-600 dark:text-red-400',
  },
}

// ─── Rebuild Progress Card ────────────────────────────────────

function RebuildCard({
  type,
  label,
  description,
}: {
  type: IndexType
  label: string
  description: string
}) {
  const logsRef = useRef<HTMLDivElement>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const queryClient = useQueryClient()

  const {
    data: raw,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'meiliSearchProgress', type],
    queryFn: ignoreAbort(() => getMeiliSearchProgress({ data: { type } })),
    refetchInterval: (query) => {
      const data = query.state.data
      if (data && (data as MeiliProgress).status === 'running') return 2000
      return false
    },
  })

  // 自动滚动日志
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight
    }
  }, [raw])

  const rebuildMutation = useMutation({
    mutationFn: () =>
      type === 'game' ? triggerGameIndexRebuild() : triggerTagIndexRebuild(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meiliStats'] })
      queryClient.invalidateQueries({
        queryKey: ['admin', 'meiliSearchProgress', type],
      })
      toast.success(`${label}重建已触发`)
      setConfirmOpen(false)
    },
    onError: (e: unknown) => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'meiliSearchProgress', type],
      })
      toast.error(`${label}重建失败: ${extractError(e)}`)
      setConfirmOpen(false)
    },
  })

  if (isLoading) {
    return (
      <div className="p-4 bg-muted/50 rounded-lg space-y-3">
        <CardSkeleton rows={2} />
      </div>
    )
  }

  const pg = raw as MeiliProgress | undefined
  const status = pg?.status ?? 'idle'
  const isRunning = status === 'running'
  const totalPages = pg?.totalPages ?? 0
  const processedPages = pg?.processedPages ?? 0
  const progressPercent =
    totalPages > 0 ? Math.round((processedPages / totalPages) * 100) : 0
  const errors = pg?.errors ?? 0
  const logs = pg?.logs ?? []

  return (
    <div className="p-4 bg-muted/50 rounded-lg space-y-3">
      <SectionHeader
        title={label}
        description={description}
        action={
          <StatusBadge
            status={
              isRunning
                ? 'running'
                : status === 'completed'
                  ? 'completed'
                  : status === 'failed'
                    ? 'failed'
                    : 'idle'
            }
          />
        }
      />

      {error ? (
        <ErrorDisplay message={extractError(error)} onRetry={() => refetch()} />
      ) : status !== 'idle' ? (
        <div className="space-y-3">
          {/* Progress Bar + Stats */}
          <div className="space-y-2">
            {totalPages > 0 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {processedPages} / {totalPages} 页
                </span>
                <span>{progressPercent}%</span>
              </div>
            )}
            {totalPages > 0 && <Progress value={progressPercent} />}
          </div>

          {/* Timestamps */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {pg?.startedAt && <span>开始: {formatTime(pg.startedAt)}</span>}
            {pg?.completedAt && <span>完成: {formatTime(pg.completedAt)}</span>}
          </div>

          {/* Errors Badge */}
          {errors > 0 && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangleIcon className="size-3" />
              {errors} 个错误
            </Badge>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <div
              ref={logsRef}
              className="bg-muted rounded-md p-2.5 max-h-36 overflow-y-auto font-mono text-xs space-y-0.5 border"
            >
              {logs.map((log, i) => {
                const cfg = logLevelConfig[log.level] ?? logLevelConfig.info
                const LIcon = cfg.icon
                return (
                  <div
                    key={`${log.time}-${i}`}
                    className={cn('flex items-start gap-1.5', cfg.className)}
                  >
                    <span className="text-muted-foreground/60 shrink-0">
                      {new Date(log.time).toLocaleTimeString()}
                    </span>
                    {LIcon && <LIcon className="size-3 shrink-0 mt-0.5" />}
                    <span className="break-all">{log.message}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground py-2">暂无重建记录</p>
      )}

      {/* Rebuild Trigger with Confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={rebuildMutation.isPending || isRunning}
            className="w-full"
          >
            {rebuildMutation.isPending ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <RefreshCwIcon className="size-3.5" />
            )}
            重建{label}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认重建{label}</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将清空现有的{label}
              索引数据，并从数据库重新导入所有文档。重建过程通常需要数分钟，
              期间搜索功能可能暂时不可用。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rebuildMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rebuildMutation.isPending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <AlertTriangleIcon className="size-4" />
              )}
              确认重建
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Main Tab ─────────────────────────────────────────────────

export function IndexesTab() {
  return (
    <div className="space-y-6">
      {/* Rebuild Section */}
      <Card>
        <CardHeader>
          <CardTitle>索引重建</CardTitle>
          <CardDescription>
            手动触发索引重建。重建操作会清空现有索引并从数据库重新导入所有数据，
            耗时通常数分钟。触发后可在此页面实时监控进度。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <RebuildCard
              type="game"
              label="游戏索引"
              description="重建 Galgame 游戏数据的全文搜索索引"
            />
            <RebuildCard
              type="tag"
              label="标签索引"
              description="重建标签数据的全文搜索索引"
            />
          </div>
        </CardContent>
      </Card>

      {/* Schedule Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">自动调度</CardTitle>
          <CardDescription>Meilisearch 索引相关的定时任务</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 text-sm">
              <Badge variant="outline" className="font-mono text-xs">
                每周日 03:00
              </Badge>
              <span>游戏索引全量重建</span>
            </div>
            <Separator />
            <div className="flex items-center gap-2.5 text-sm">
              <Badge variant="outline" className="font-mono text-xs">
                每周日 03:00
              </Badge>
              <span>标签索引全量重建</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
