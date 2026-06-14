import { Button } from '@web/components/ui/button'
import { Spinner } from '@web/components/ui/spinner'
import { XCircleIcon } from 'lucide-react'

export function LoadingSpinner({ text = '加载中...' }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
      <Spinner className="size-5" />
      <span>{text}</span>
    </div>
  )
}

export function ErrorDisplay({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <XCircleIcon className="size-8 text-destructive" />
      <p className="text-destructive text-sm">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          重试
        </Button>
      )}
    </div>
  )
}

export function StatItem({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}

export function formatBytes(bytes: number | undefined): string {
  if (bytes == null) return '-'
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

/**
 * 包装 server function 用于 React Query：静默捕获 AbortError。
 * TanStack Start 的 createServerFn 内部自行管理 AbortController，
 * React Query 的 observer 销毁时发出的 abort 与之冲突，不应作为错误抛出。
 */
export function ignoreAbort<T>(
  fn: () => Promise<T>,
): () => Promise<T | undefined> {
  return async () => {
    try {
      return await fn()
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return undefined
      }
      throw e
    }
  }
}
