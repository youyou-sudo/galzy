import { StatusPill, type StatusTone } from "@web/components/admin/admin-table";
import { EmptyState as SharedEmptyState } from "@web/components/shared/empty-state";
import { IconTile } from "@web/components/shared/icon-tile";
import { Button } from "@web/components/ui/button";
import { Skeleton } from "@web/components/ui/skeleton";
import { Spinner } from "@web/components/ui/spinner";
import {
	AlertTriangleIcon,
	CheckCircleIcon,
	DatabaseIcon,
	InboxIcon,
	SearchIcon,
	TagIcon,
	XCircleIcon,
} from "lucide-react";
import type { ReactNode } from "react";

// ─── Loading ──────────────────────────────────────────────────

export function LoadingSpinner({ text = "加载中..." }: { text?: string }) {
	return (
		<div className="flex gap-2 justify-center items-center py-8 text-muted-foreground">
			<Spinner className="size-5" />
			<span>{text}</span>
		</div>
	);
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
	return (
		<div className="p-6 space-y-3">
			<Skeleton className="w-1/3 h-5" />
			<Skeleton className="w-2/3 h-4" />
			{Array.from({ length: rows }).map((_, i) => (
				<Skeleton key={i} className="w-full h-10" />
			))}
		</div>
	);
}

export function StatSkeleton() {
	return (
		<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
			{Array.from({ length: 4 }).map((_, i) => (
				<div key={i} className="space-y-2">
					<Skeleton className="w-16 h-3" />
					<Skeleton className="w-20 h-7" />
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
		<div className="flex flex-col gap-3 items-center py-8 text-center">
			<IconTile icon={XCircleIcon} size="lg" tone="destructive" />
			<div>
				<p className="text-sm font-medium">加载失败</p>
				<p className="mt-0.5 max-w-sm text-sm text-muted-foreground">
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
	text = "暂无数据",
	description,
}: {
	icon?: typeof InboxIcon;
	text?: string;
	description?: string;
}) {
	return (
		<SharedEmptyState
			icon={Icon}
			title={text}
			description={description}
			size="sm"
		/>
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
	variant = "default",
}: {
	icon: typeof DatabaseIcon;
	label: string;
	value: ReactNode;
	description?: string;
	variant?: "default" | "success" | "warning" | "danger";
}) {
	const variantTones = {
		default: "muted",
		success: "success",
		warning: "warning",
		danger: "destructive",
	} as const;

	return (
		<div className="flex gap-3 items-start p-4 bg-card rounded-xl ring-1 ring-border/60">
			<IconTile icon={Icon} size="md" tone={variantTones[variant]} />
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
		<div className="flex gap-4 justify-between items-start">
			<div>
				<h3 className="text-sm font-semibold">{title}</h3>
				{description && (
					<p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
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
	status: "idle" | "running" | "completed" | "failed";
}) {
	const config: Record<
		"idle" | "running" | "completed" | "failed",
		{ label: string; tone: StatusTone; icon?: typeof CheckCircleIcon }
	> = {
		idle: { label: "空闲", tone: "neutral" },
		running: { label: "运行中", tone: "info" },
		completed: { label: "已完成", tone: "success", icon: CheckCircleIcon },
		failed: { label: "失败", tone: "destructive", icon: AlertTriangleIcon },
	};

	const c = config[status];
	return (
		<StatusPill tone={c.tone} icon={c.icon} spin={status === "running"}>
			{c.label}
		</StatusPill>
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
	if (bytes == null) return "-";
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

export function formatNumber(n: number | undefined | null): string {
	if (n == null) return "-";
	return n.toLocaleString();
}

export function formatTime(iso: string | null | undefined): string {
	if (!iso) return "-";
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
}

export function relativeTime(iso: string | null | undefined): string {
	if (!iso) return "";
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
		return "";
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
			if (e instanceof DOMException && e.name === "AbortError") {
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
	if (typeof err === "string") return err;
	if (err && typeof err === "object") {
		const e = err as Record<string, unknown>;
		if (typeof e.value === "object" && e.value) {
			const v = e.value as Record<string, unknown>;
			if (typeof v.message === "string") return v.message;
		}
		if (typeof e.message === "string") return e.message;
	}
	return "未知错误";
}

/**
 * 安全提取 Eden Treaty 错误消息
 */
export function extractEdenError(err: unknown): string | null {
	if (!err || typeof err !== "object") return null;
	const e = err as Record<string, unknown>;
	if (typeof e.value === "object" && e.value) {
		const v = e.value as Record<string, unknown>;
		if (typeof v.message === "string") return v.message;
	}
	return null;
}
