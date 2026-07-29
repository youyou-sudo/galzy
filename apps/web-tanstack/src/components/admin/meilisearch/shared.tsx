import { Button } from '@web/components/ui/button';
import { Skeleton } from '@web/components/ui/skeleton';
import { Spinner } from '@web/components/ui/spinner';
import { cn } from '@web/lib/utils';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  DatabaseIcon,
  InboxIcon,
  SearchIcon,
  TagIcon,
  XCircleIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

// ─── Loading ──────────────────────────────────────────────────

export function LoadingSpinner({ text = '加载中...' }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
      <Spinner className="size-5" />
      <span>{text}</span>
    </div>
  );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-6">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-20" />
        </div>
      ))}
    </div>
  );
}

// ─── Error ────────────────────────────────────────────────────

export function ErrorDisplay({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <div className="flex items-center justify-center size-12 rounded-full bg-destructive/10">
        <XCircleIcon className="size-6 text-destructive" />
      </div>
      <div>
        <p className="text-sm font-medium">加载失败</p>
        <p className="text-sm text-muted-foreground mt-0.5 max-w-sm">
          {message}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          重试
        </Button>
      )}
    </div>
  );
}

// ─── Empty ────────────────────────────────────────────────────

export function EmptyState({
  icon: Icon = InboxIcon,
  text = '暂无数据',
  description,
}: {
  icon?: typeof InboxIcon;
  text?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <Icon className="size-8 text-muted-foreground/40" />
      <p className="text-sm font-medium text-muted-foreground">{text}</p>
      {description && (
        <p className="text-xs text-muted-foreground/70">{description}</p>
      )}
    </div>
  );
}

// ─── Stats ────────────────────────────────────────────────────

export function StatItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  description,
  variant = 'default',
}: {
  icon: typeof DatabaseIcon;
  label: string;
  value: ReactNode;
  description?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const variantStyles = {
    default: 'bg-muted/50 text-muted-foreground',
    success: 'bg-green-500/10 text-green-600 dark:text-green-400',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    danger: 'bg-red-500/10 text-red-600 dark:text-red-400',
  };

  return (
    <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
      <div
        className={cn(
          'flex items-center justify-center size-9 rounded-lg shrink-0',
          variantStyles[variant],
        )}
      >
        <Icon className="size-4.5" />
      </div>
      <div className="space-y-0.5 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums truncate">{value}</p>
        {description && (
          <p className="text-xs text-muted-foreground/70 truncate">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────

export function StatusBadge({
  status,
}: {
  status: 'idle' | 'running' | 'completed' | 'failed';
}) {
  const config = {
    idle: { label: '空闲', className: 'bg-muted text-muted-foreground' },
    running: {
      label: '运行中',
      className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    },
    completed: {
      label: '已完成',
      className: 'bg-green-500/10 text-green-600 dark:text-green-400',
    },
    failed: {
      label: '失败',
      className: 'bg-red-500/10 text-red-600 dark:text-red-400',
    },
  } as const;

  const c = config[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        c.className,
      )}
    >
      {status === 'running' && <Spinner className="size-3" />}
      {status === 'completed' && <CheckCircleIcon className="size-3" />}
      {status === 'failed' && <AlertTriangleIcon className="size-3" />}
      {c.label}
    </span>
  );
}

// ─── Index Icon ───────────────────────────────────────────────

const indexIconMap: Record<string, typeof DatabaseIcon> = {
  games: SearchIcon,
  game: SearchIcon,
  tags: TagIcon,
  tag: TagIcon,
};

export function indexIcon(name: string): typeof DatabaseIcon {
  for (const [key, icon] of Object.entries(indexIconMap)) {
    if (name.toLowerCase().includes(key)) return icon;
  }
  return DatabaseIcon;
}

// ─── Utils ────────────────────────────────────────────────────

export function formatBytes(bytes: number | undefined): string {
  if (bytes == null) return '-';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

export function formatNumber(n: number | undefined | null): string {
  if (n == null) return '-';
  return n.toLocaleString();
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds} 秒前`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    return `${days} 天前`;
  } catch {
    return '';
  }
}

/**
 * 包装 server function 用于 React Query：静默捕获 AbortError。
 */
export function ignoreAbort<T>(
  fn: () => Promise<T>,
): () => Promise<T | undefined> {
  return async () => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return undefined;
      }
      throw e;
    }
  };
}

/**
 * 安全提取错误消息 — 处理 Error、字符串、Eden 响应等异构形态
 */
export function extractError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    if (typeof e.value === 'object' && e.value) {
      const v = e.value as Record<string, unknown>;
      if (typeof v.message === 'string') return v.message;
    }
    if (typeof e.message === 'string') return e.message;
  }
  return '未知错误';
}

/**
 * 安全提取 Eden Treaty 错误消息
 */
export function extractEdenError(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as Record<string, unknown>;
  if (typeof e.value === 'object' && e.value) {
    const v = e.value as Record<string, unknown>;
    if (typeof v.message === 'string') return v.message;
  }
  return null;
}
