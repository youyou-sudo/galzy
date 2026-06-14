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
import { Input } from '@web/components/ui/input'
import { Label } from '@web/components/ui/label'
import { Spinner } from '@web/components/ui/spinner'
import {
  getMeiliTaskStatus,
  getSearchTask,
  getSearchTasks,
  searchMeili,
  triggerGameIndexRebuild,
  triggerTagIndexRebuild,
} from '@web/server/admin/meilisearch'
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ExternalLinkIcon,
  HistoryIcon,
  ListTodoIcon,
  Loader2Icon,
  RefreshCwIcon,
  SearchIcon,
  XCircleIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ErrorDisplay, ignoreAbort, LoadingSpinner } from './shared'

// ── 类型 ──────────────────────────────────────────────

interface TaskSummary {
  label: string
  indexName?: string
  total: number
  succeeded: number
  failed: number
  error?: string
  taskUids?: number[]
  tasks?: Array<{
    uid: number
    status: string
    error: unknown
    duration: string
  }>
  finishedAt: string
  elapsedMs: number
}

interface LiveTaskDetail {
  uid: number
  status: string
  error: unknown
  duration?: string
  finishedAt?: string
  details?: {
    receivedDocuments?: number
    indexedDocuments?: number
  }
}

interface SearchTaskRecord {
  key: string
  type?: string
  taskUid?: number
  indexUid?: string
  status?: string
  enqueuedAt?: string
}

// ── 工具函数 ──────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}m ${sec}s`
}

function formatElapsed(duration: string | undefined): string {
  if (!duration) return '-'
  const m = duration.match(
    /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/,
  )
  if (!m) return duration
  const days = parseInt(m[1] || '0')
  const hours = parseInt(m[2] || '0')
  const minutes = parseInt(m[3] || '0')
  const seconds = parseFloat(m[4] || '0')
  const totalMs = (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000
  if (totalMs < 1000) return `${totalMs.toFixed(0)}ms`
  if (totalMs < 60000) return `${(totalMs / 1000).toFixed(1)}s`
  return `${Math.floor(totalMs / 60000)}m ${Math.floor((totalMs % 60000) / 1000)}s`
}

function formatElapsedTime(startMs: number): string {
  const elapsed = Date.now() - startMs
  if (elapsed < 1000) return '刚刚开始...'
  return formatDuration(elapsed)
}

function taskStatusBadge(status: string) {
  switch (status) {
    case 'succeeded':
      return (
        <Badge
          variant="outline"
          className="text-green-600 border-green-300 bg-green-50"
        >
          <CheckCircleIcon className="size-3 mr-1" />
          成功
        </Badge>
      )
    case 'failed':
      return (
        <Badge
          variant="outline"
          className="text-red-600 border-red-300 bg-red-50"
        >
          <XCircleIcon className="size-3 mr-1" />
          失败
        </Badge>
      )
    case 'processing':
    case 'enqueued':
      return (
        <Badge
          variant="outline"
          className="text-blue-600 border-blue-300 bg-blue-50"
        >
          <Loader2Icon className="size-3 mr-1 animate-spin" />
          进行中
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground">
          {status}
        </Badge>
      )
  }
}

const LABEL_NAMES: Record<string, string> = {
  meiliSearchAddIndex: '游戏索引',
  meiliSearchAddTag: '标签索引',
}

const SEARCH_TASK_TYPES: Record<string, string> = {
  embeddersUpdate: 'Embedders 更新',
  searchableAttributesUpdate: '搜索属性更新',
}

function formatSearchTaskType(type: string | undefined): string {
  if (!type) return '未知'
  return SEARCH_TASK_TYPES[type] || type
}

// ── 组件 ──────────────────────────────────────────────

export function IndexesTab() {
  const queryClient = useQueryClient()

  // ── 重建计时 ──
  const rebuildStartRef = useRef<number | null>(null)
  const [rebuildElapsed, setRebuildElapsed] = useState<string | null>(null)

  // ── 重建 mutation ──

  const rebuildGame = useMutation({
    mutationFn: triggerGameIndexRebuild,
    onMutate: () => {
      rebuildStartRef.current = Date.now()
      setRebuildElapsed('正在准备...')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meiliStats'] })
      queryClient.invalidateQueries({ queryKey: ['meiliTaskStatus'] })
      queryClient.invalidateQueries({ queryKey: ['searchTasks'] })
      setRebuildElapsed(null)
      rebuildStartRef.current = null
      toast.success('游戏索引重建任务已完成！')
    },
    onError: (e: Error) => {
      setRebuildElapsed(null)
      rebuildStartRef.current = null
      toast.error(e.message ?? '触发失败')
    },
  })

  const rebuildTag = useMutation({
    mutationFn: triggerTagIndexRebuild,
    onMutate: () => {
      rebuildStartRef.current = Date.now()
      setRebuildElapsed('正在准备...')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meiliStats'] })
      queryClient.invalidateQueries({ queryKey: ['meiliTaskStatus'] })
      queryClient.invalidateQueries({ queryKey: ['searchTasks'] })
      setRebuildElapsed(null)
      rebuildStartRef.current = null
      toast.success('标签索引重建任务已完成！')
    },
    onError: (e: Error) => {
      setRebuildElapsed(null)
      rebuildStartRef.current = null
      toast.error(e.message ?? '触发失败')
    },
  })

  const isRebuilding = rebuildGame.isPending || rebuildTag.isPending
  const rebuildingLabel = rebuildGame.isPending ? '游戏索引' : '标签索引'

  // ── 重建计时器 ──
  useEffect(() => {
    if (!isRebuilding || !rebuildStartRef.current) return
    const timer = setInterval(() => {
      if (rebuildStartRef.current) {
        setRebuildElapsed(formatElapsedTime(rebuildStartRef.current))
      }
    }, 500)
    return () => clearInterval(timer)
  }, [isRebuilding])

  // ── 任务状态查询（重建中轮询加快）──

  const {
    data: taskData,
    isLoading: taskLoading,
    error: taskError,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: ['meiliTaskStatus'],
    queryFn: ignoreAbort(getMeiliTaskStatus),
    refetchInterval: isRebuilding ? 3_000 : 15_000,
  })

  const tasks = (taskData ?? []) as TaskSummary[]
  const sorted = [...tasks].sort(
    (a, b) =>
      new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime(),
  )

  // ── 单个任务实时状态缓存 ──
  const [liveTaskMap, setLiveTaskMap] = useState<Record<number, LiveTaskDetail>>({})
  const [fetchingUids, setFetchingUids] = useState<Set<number>>(new Set())

  const fetchLiveTask = async (uid: number) => {
    if (fetchingUids.has(uid)) return
    setFetchingUids((prev) => new Set(prev).add(uid))
    try {
      const detail = await getSearchTask({ data: { uid } })
      setLiveTaskMap((prev) => ({
        ...prev,
        [uid]: detail as LiveTaskDetail,
      }))
    } catch {
      toast.error(`获取任务 ${uid} 状态失败`)
    } finally {
      setFetchingUids((prev) => {
        const next = new Set(prev)
        next.delete(uid)
        return next
      })
    }
  }

  // ── 搜索任务记录 ──
  const { data: searchTasksData, isLoading: searchTasksLoading } = useQuery({
    queryKey: ['searchTasks'],
    queryFn: ignoreAbort(getSearchTasks),
    refetchInterval: 30_000,
  })

  const searchTaskRecords = (searchTasksData ?? []) as SearchTaskRecord[]

  // ── 搜索测试 ──

  const [searchQuery, setSearchQuery] = useState('')
  const [searchLimit, setSearchLimit] = useState(20)

  const searchMutation = useMutation({
    mutationFn: () => {
      return searchMeili({
        data: { q: searchQuery, limit: searchLimit },
      })
    },
  })

  const searchResult = searchMutation.data as {
    hits?: Array<Record<string, unknown>>
    topTag?: Record<string, unknown>
  } | null

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    searchMutation.mutate()
  }

  // ── 渲染 ──

  return (
    <div className="space-y-4">
      {/* 索引重建 */}
      <Card>
        <CardHeader>
          <CardTitle>索引重建</CardTitle>
          <CardDescription>
            手动触发索引重建。重建操作会清空现有索引并从数据库重新导入所有数据，耗时较长（通常数分钟）。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 重建进度条 */}
          {isRebuilding && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Loader2Icon className="size-4 animate-spin text-blue-600" />
                <span className="font-medium text-blue-700">
                  正在重建 {rebuildingLabel}...
                </span>
                <span className="text-sm text-blue-500 ml-auto font-mono">
                  {rebuildElapsed}
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-1.5 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full animate-pulse w-2/3" />
              </div>
              <p className="text-xs text-blue-600">
                重建正在进行中，请耐心等待。完成后任务结果将自动显示在下方。
              </p>
            </div>
          )}

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
                onClick={() => rebuildGame.mutate(undefined)}
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
                onClick={() => rebuildTag.mutate(undefined)}
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

      {/* 搜索测试 */}
      <Card>
        <CardHeader>
          <CardTitle>搜索测试</CardTitle>
          <CardDescription>
            验证索引重建后搜索功能是否正常工作
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="search-query" className="text-xs">
                搜索关键词
              </Label>
              <div className="relative">
                <SearchIcon className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="search-query"
                  className="pl-9"
                  placeholder="输入关键词测试搜索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="w-full sm:w-24 space-y-1.5">
              <Label htmlFor="search-limit" className="text-xs">
                条数
              </Label>
              <Input
                id="search-limit"
                type="number"
                min={1}
                max={100}
                value={searchLimit}
                onChange={(e) =>
                  setSearchLimit(Math.max(1, Math.min(100, Number(e.target.value) || 20)))
                }
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={searchMutation.isPending || !searchQuery.trim()}>
                {searchMutation.isPending ? (
                  <Spinner className="size-4 mr-1" />
                ) : (
                  <SearchIcon className="size-4 mr-1" />
                )}
                搜索
              </Button>
            </div>
          </form>

          {/* 搜索结果 */}
          {searchMutation.isError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {searchMutation.error instanceof Error
                ? searchMutation.error.message
                : '搜索出错'}
            </div>
          )}

          {searchResult && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">
                  {searchResult.hits?.length ?? 0} 条结果
                </Badge>
                {searchResult.topTag && (
                  <Badge variant="outline" className="text-xs">
                    匹配标签: {(searchResult.topTag as Record<string, string>)?.name ?? '-'}
                  </Badge>
                )}
              </div>

              <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                {searchResult.hits && searchResult.hits.length > 0 ? (
                  searchResult.hits.map((hit, idx) => {
                    const h = hit as Record<string, unknown>
                    const title =
                      (h.titles as Array<{ lang: string; title: string }> | undefined)?.find(
                        (t) => t.lang === 'zh-Hans',
                      )?.title ||
                      (h.titles as Array<{ lang: string; title: string }> | undefined)?.[0]
                        ?.title ||
                      '-'
                    const id = (h.id ?? idx) as string | number
                    const released = h.released_first as string | undefined
                    return (
                      <div
                        key={id}
                        className="p-3 hover:bg-muted/30 transition-colors space-y-1"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{String(title)}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">
                              ID: {id}
                              {released
                                ? ` · 发售: ${released}`
                                : ''}
                            </p>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            #{(idx + 1).toString().padStart(2, '0')}
                          </Badge>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                    <SearchIcon className="size-8" />
                    <p className="text-sm">无匹配结果</p>
                    <p className="text-xs">尝试其他关键词或检查索引是否为空</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {!searchResult && !searchMutation.isPending && !searchMutation.isError && (
            <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground border rounded-lg border-dashed">
              <SearchIcon className="size-8" />
              <p className="text-sm">输入关键词测试搜索功能</p>
              <p className="text-xs">索引重建后建议在此验证搜索是否正常</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 任务状态（实时） */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>最近任务</CardTitle>
            <CardDescription>
              索引重建任务执行结果
              {isRebuilding
                ? ` · 重建中，每 3 秒刷新`
                : ` · 每 15 秒自动刷新`}
              {sorted.length > 0 && ` · 共 ${sorted.length} 条记录`}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchTasks()}>
            <RefreshCwIcon className="size-4 mr-1" />
            刷新
          </Button>
        </CardHeader>
        <CardContent>
          {taskLoading ? (
            <LoadingSpinner text="正在获取任务状态..." />
          ) : taskError ? (
            <ErrorDisplay
              message={
                taskError instanceof Error ? taskError.message : '加载失败'
              }
              onRetry={() => refetchTasks()}
            />
          ) : sorted.length === 0 && !isRebuilding ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <ListTodoIcon className="size-10" />
              <p>暂无任务记录</p>
              <p className="text-xs">触发索引重建后，任务状态将在此显示</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map((task, idx) => {
                const hasError = task.error != null
                const hasFailures = task.failed > 0
                const isHealthy = !hasError && !hasFailures

                return (
                  <div
                    key={task.finishedAt + idx}
                    className="p-4 bg-muted/50 rounded-lg space-y-3"
                  >
                    {/* 头部 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {LABEL_NAMES[task.label] || task.label}
                        </span>
                        {isHealthy ? (
                          <Badge
                            variant="outline"
                            className="text-green-600 border-green-300 bg-green-50"
                          >
                            <CheckCircleIcon className="size-3 mr-1" />
                            全部成功
                          </Badge>
                        ) : hasError ? (
                          <Badge
                            variant="outline"
                            className="text-red-600 border-red-300 bg-red-50"
                          >
                            <XCircleIcon className="size-3 mr-1" />
                            执行错误
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-amber-600 border-amber-300 bg-amber-50"
                          >
                            <AlertTriangleIcon className="size-3 mr-1" />
                            部分失败
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ClockIcon className="size-3" />
                        {new Date(task.finishedAt).toLocaleString()}
                      </div>
                    </div>

                    {/* 统计 */}
                    {!hasError && (
                      <div className="grid grid-cols-4 gap-3 text-center">
                        <div className="bg-background rounded p-2">
                          <p className="text-lg font-semibold">{task.total}</p>
                          <p className="text-[10px] text-muted-foreground">
                            总任务
                          </p>
                        </div>
                        <div className="bg-background rounded p-2">
                          <p className="text-lg font-semibold text-green-600">
                            {task.succeeded}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            成功
                          </p>
                        </div>
                        <div className="bg-background rounded p-2">
                          <p
                            className={`text-lg font-semibold ${task.failed > 0 ? 'text-red-600' : ''}`}
                          >
                            {task.failed}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            失败
                          </p>
                        </div>
                        <div className="bg-background rounded p-2">
                          <p className="text-lg font-semibold">
                            {formatDuration(task.elapsedMs)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            总耗时
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 错误信息 */}
                    {hasError && (
                      <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                        <p className="font-medium">错误信息：</p>
                        <p className="break-all mt-1">{task.error}</p>
                        {task.taskUids && (
                          <p className="mt-1 text-red-500">
                            任务 UID: {task.taskUids.join(', ')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* 子任务详情（含实时状态） */}
                    {task.tasks && task.tasks.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          子任务详情 ({task.tasks.length})：
                        </p>
                        <div className="max-h-64 overflow-y-auto space-y-1">
                          {task.tasks.map((t) => {
                            const live = liveTaskMap[t.uid]
                            const displayStatus = live?.status ?? t.status
                            const displayError = live?.error ?? t.error
                            const displayDuration = live?.duration ?? t.duration

                            return (
                              <div
                                key={t.uid}
                                className={`p-2 rounded text-xs border ${
                                  displayStatus === 'failed'
                                    ? 'bg-red-50 border-red-100'
                                    : displayStatus === 'succeeded'
                                      ? 'bg-green-50 border-green-100'
                                      : displayStatus === 'processing' ||
                                          displayStatus === 'enqueued'
                                        ? 'bg-blue-50 border-blue-100'
                                        : 'bg-background'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-mono text-[10px] shrink-0">
                                      UID {t.uid}
                                    </span>
                                    {taskStatusBadge(displayStatus)}
                                    {live?.details && (
                                      <span className="text-[10px] text-muted-foreground">
                                        已索引: {live.details.indexedDocuments ?? '?'} /{' '}
                                        {live.details.receivedDocuments ?? '?'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-muted-foreground text-[10px]">
                                      {formatElapsed(displayDuration)}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-5"
                                      onClick={() => fetchLiveTask(t.uid)}
                                      disabled={fetchingUids.has(t.uid)}
                                      title="刷新实时状态"
                                    >
                                      {fetchingUids.has(t.uid) ? (
                                        <Spinner className="size-3" />
                                      ) : (
                                        <RefreshCwIcon className="size-3" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                                {displayError && (
                                  <p className="text-red-600 mt-1 break-all">
                                    {typeof displayError === 'string'
                                      ? displayError
                                      : JSON.stringify(displayError)}
                                  </p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* 失败任务详情（旧版兼容） */}
                    {hasFailures && task.tasks && !task.tasks.every((t) => !!liveTaskMap[t.uid]) && (
                      <p className="text-[10px] text-muted-foreground">
                        点击子任务旁的刷新按钮可获取 Meilisearch 实时状态
                      </p>
                    )}

                    {/* 索引名 */}
                    {task.indexName && (
                      <p className="text-[10px] text-muted-foreground">
                        索引：{task.indexName}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 搜索任务记录 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>搜索任务记录</CardTitle>
            <CardDescription>
              Embedder 更新、搜索属性更新等操作产生的任务记录
              {searchTaskRecords.length > 0 &&
                ` · 共 ${searchTaskRecords.length} 条`}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ['searchTasks'] })
            }
          >
            <RefreshCwIcon className="size-4 mr-1" />
            刷新
          </Button>
        </CardHeader>
        <CardContent>
          {searchTasksLoading ? (
            <LoadingSpinner text="正在获取搜索任务记录..." />
          ) : searchTaskRecords.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <HistoryIcon className="size-10" />
              <p>暂无搜索任务记录</p>
              <p className="text-xs">
                更新 Embedders 或搜索属性后，任务记录将在此显示
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {searchTaskRecords.map((record) => {
                const live = record.taskUid ? liveTaskMap[record.taskUid] : null
                const displayStatus =
                  live?.status ?? record.status ?? 'unknown'
                return (
                  <div
                    key={record.key}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {formatSearchTaskType(record.type)}
                      </Badge>
                      {record.taskUid && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          UID {record.taskUid}
                        </span>
                      )}
                      {record.indexUid && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          索引: {record.indexUid}
                        </span>
                      )}
                      {taskStatusBadge(displayStatus)}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground">
                        {record.enqueuedAt
                          ? new Date(record.enqueuedAt).toLocaleString()
                          : '-'}
                      </span>
                      {record.taskUid && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-5"
                          onClick={() => fetchLiveTask(record.taskUid!)}
                          disabled={fetchingUids.has(record.taskUid)}
                          title="刷新实时状态"
                        >
                          {fetchingUids.has(record.taskUid!) ? (
                            <Spinner className="size-3" />
                          ) : (
                            <ExternalLinkIcon className="size-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
