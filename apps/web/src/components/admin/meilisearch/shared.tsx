import type { QueryKey } from "@tanstack/react-query";
import { StatusPill, type StatusTone } from "@web/components/admin/admin-table";
import { EmptyState as SharedEmptyState } from "@web/components/shared/empty-state";
import { IconTile } from "@web/components/shared/icon-tile";
import { Button } from "@web/components/ui/button";
import { Skeleton } from "@web/components/ui/skeleton";
import { useAdminMutation } from "@web/hooks/use-admin-mutation";
import { adminKeys } from "@web/lib/admin/query-keys";
import { cn } from "@web/lib/utils";
import {
	triggerGameIndexRebuild,
	triggerProducerIndexRebuild,
	triggerTagIndexRebuild,
} from "@web/server/admin/meilisearch";
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
import type { IndexType, MeiliProgress, MeiliStats } from "./types";

// ─── Loading ──────────────────────────────────────────────────

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
	return (
		<div className="p-6 space-y-3">
			<Skeleton className="w-1/3 h-5" />
			<Skeleton className="w-2/3 h-4" />
			{Array.from({ length: rows }).map((_, index) => (
				<Skeleton key={index} className="w-full h-10" />
			))}
		</div>
	);
}

export function StatSkeleton() {
	return (
		<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
			{Array.from({ length: 4 }).map((_, index) => (
				<div
					key={index}
					className="flex gap-3 items-start p-4 bg-card rounded-2xl ring-1 ring-border/60"
				>
					<Skeleton className="size-9 rounded-xl" />
					<div className="flex flex-col gap-1.5">
						<Skeleton className="w-16 h-3" />
						<Skeleton className="w-20 h-5" />
					</div>
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
	action,
}: {
	icon?: typeof InboxIcon;
	text?: string;
	description?: string;
	action?: ReactNode;
}) {
	return (
		<SharedEmptyState
			icon={Icon}
			title={text}
			description={description}
			action={action}
			size="sm"
		/>
	);
}

// ─── Panel（统一的卡片底板） ─────────────────────────────────

/**
 * 面板底板：所有内嵌区块（进度卡 / 属性云 / 字段列表）共用一套圆角与描边，
 * 与外层 Card 的 rounded-2xl + ring-1 ring-border/60 视觉一致。
 */
export function Panel({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"p-4 bg-muted/40 rounded-xl ring-1 ring-border/60",
				className,
			)}
		>
			{children}
		</div>
	);
}

// ─── Stats ────────────────────────────────────────────────────

/** 统一 KPI 卡：图标底片 + 标签 + 数值 + 说明（数字 tabular-nums）。 */
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
	description?: ReactNode;
	variant?: "default" | "success" | "warning" | "danger" | "info";
}) {
	const variantTones = {
		default: "muted",
		success: "success",
		warning: "warning",
		danger: "destructive",
		info: "info",
	} as const;

	return (
		<div className="flex gap-3 items-start p-4 bg-card rounded-2xl ring-1 ring-border/60">
			<IconTile icon={Icon} size="md" tone={variantTones[variant]} />
			<div className="flex flex-col gap-0.5 min-w-0">
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

/** 迷你占比条（无图表库，用它表达分布/进度）。 */
const barTones = {
	primary: "bg-primary",
	success: "bg-success",
	info: "bg-info",
	warning: "bg-warning",
} as const;

export function MiniBar({
	value,
	tone = "primary",
	className,
}: {
	/** 0-100 */
	value: number;
	tone?: keyof typeof barTones;
	className?: string;
}) {
	const width = Math.max(0, Math.min(100, value));
	return (
		<div
			className={cn(
				"overflow-hidden w-full h-1.5 bg-muted rounded-full",
				className,
			)}
		>
			<div
				className={cn("h-full rounded-full transition-[width]", barTones[tone])}
				style={{ width: `${width}%` }}
			/>
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
		running: { label: "重建中", tone: "info" },
		completed: { label: "已完成", tone: "success", icon: CheckCircleIcon },
		failed: { label: "失败", tone: "destructive", icon: AlertTriangleIcon },
	};

	const current = config[status];
	return (
		<StatusPill
			tone={current.tone}
			icon={current.icon}
			spin={status === "running"}
		>
			{current.label}
		</StatusPill>
	);
}

// ─── 索引类型元数据 ───────────────────────────────────────────

export const indexTypeLabels: Record<IndexType, string> = {
	game: "游戏",
	tag: "标签",
	producer: "厂商",
};

/** 索引名 → 索引类型（env 配置的索引名不在前端，只能按关键片段识别）。 */
export function indexTypeFromName(name: string): IndexType | null {
	const lower = name.toLowerCase();
	if (lower.includes("game")) return "game";
	if (lower.includes("tag")) return "tag";
	if (lower.includes("producer")) return "producer";
	return null;
}

const indexIconMap: Record<string, typeof DatabaseIcon> = {
	games: SearchIcon,
	game: SearchIcon,
	tags: TagIcon,
	tag: TagIcon,
};

export function indexIcon(name: string): typeof DatabaseIcon {
	const lower = name.toLowerCase();
	for (const [key, icon] of Object.entries(indexIconMap)) {
		if (lower.includes(key)) return icon;
	}
	return DatabaseIcon;
}

// ─── 索引重建（乐观更新） ────────────────────────────────────

/** 触发重建后的乐观进度：立即把该索引状态切成「重建中」。 */
export function optimisticRebuildProgress(
	previous: MeiliProgress | undefined,
	type: IndexType,
): MeiliProgress {
	const now = new Date().toISOString();
	return {
		status: "running",
		type,
		startedAt: now,
		completedAt: null,
		totalPages: 0,
		processedPages: 0,
		errors: 0,
		logs: [
			...(previous?.logs ?? []).slice(-99),
			{
				time: now,
				level: "info",
				message: `${indexTypeLabels[type]}索引重建已触发，等待 worker 执行…`,
			},
		],
		lastUpdated: now,
	};
}

/**
 * 索引重建写操作。
 *
 * 触发后立刻把 adminKeys.meiliIndexes(type) 的进度切成 running，
 * 失败由 useAdminMutation 回滚快照并 toast，不需要页面自己管错误。
 */
export function useRebuildIndex(
	type: IndexType,
	options?: { mutationKey?: QueryKey; indexName?: string },
) {
	const trigger =
		type === "game"
			? triggerGameIndexRebuild
			: type === "tag"
				? triggerTagIndexRebuild
				: triggerProducerIndexRebuild;

	return useAdminMutation<unknown, void>({
		mutationKey: options?.mutationKey,
		mutationFn: () => trigger(),
		optimistic: (queryClient) => {
			queryClient.setQueryData<MeiliProgress>(
				adminKeys.meiliIndexes(type),
				(previous) => optimisticRebuildProgress(previous, type),
			);
			// 概览页的索引表也立刻显示「索引中」，不必等统计接口回来
			const indexName = options?.indexName;
			if (!indexName) return;
			queryClient.setQueryData<MeiliStats>(
				adminKeys.meiliStats(),
				(previous) => {
					if (!previous?.indexes?.[indexName]) return previous;
					return {
						...previous,
						indexes: {
							...previous.indexes,
							[indexName]: { ...previous.indexes[indexName], isIndexing: true },
						},
					};
				},
			);
		},
		affects: [adminKeys.meiliIndexes(type), adminKeys.meiliStats()],
		successMessage: `${indexTypeLabels[type]}索引重建已触发`,
		errorMessage: (error) =>
			`${indexTypeLabels[type]}索引重建失败：${extractError(error)}`,
	});
}

// ─── Utils ────────────────────────────────────────────────────

export function formatBytes(bytes: number | undefined): string {
	if (bytes == null) return "-";
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const index = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** index).toFixed(2))} ${sizes[index]}`;
}

export function formatNumber(value: number | undefined | null): string {
	if (value == null) return "-";
	return value.toLocaleString();
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
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				return undefined;
			}
			throw error;
		}
	};
}

/**
 * 安全提取错误消息 — 处理 Error、字符串、Eden 响应等异构形态
 */
export function extractError(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	if (error && typeof error === "object") {
		const value = error as Record<string, unknown>;
		if (typeof value.value === "object" && value.value) {
			const inner = value.value as Record<string, unknown>;
			if (typeof inner.message === "string") return inner.message;
		}
		if (typeof value.message === "string") return value.message;
	}
	return "未知错误";
}

/**
 * 安全提取 Eden Treaty 错误消息
 */
export function extractEdenError(error: unknown): string | null {
	if (!error || typeof error !== "object") return null;
	const value = error as Record<string, unknown>;
	if (typeof value.value === "object" && value.value) {
		const inner = value.value as Record<string, unknown>;
		if (typeof inner.message === "string") return inner.message;
	}
	return null;
}
