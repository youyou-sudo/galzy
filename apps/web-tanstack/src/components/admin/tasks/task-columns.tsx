import { StatusPill, type StatusTone } from "@web/components/admin/admin-table";
import type { AdminColumn } from "@web/components/admin/data-table";
import { Badge } from "@web/components/ui/badge";
import { Progress } from "@web/components/ui/progress";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@web/components/ui/tooltip";
import { cn } from "@web/lib/utils";
import {
	AlertTriangleIcon,
	CheckCircleIcon,
	ClockIcon,
	Loader2Icon,
	XCircleIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { TaskRow, TaskStatusKey } from "./types";

/** 各状态的中文名与色板（State 全局唯一来源是 /tasks/meta，这里只做兜底）。 */
const STATUS_FALLBACK: Record<
	TaskStatusKey,
	{ label: string; tone: StatusTone; icon: typeof ClockIcon }
> = {
	queued: { label: "排队中", tone: "neutral", icon: ClockIcon },
	running: { label: "运行中", tone: "info", icon: Loader2Icon },
	completed: { label: "已完成", tone: "success", icon: CheckCircleIcon },
	failed: { label: "失败", tone: "destructive", icon: XCircleIcon },
	"dead-letter": { label: "死信", tone: "warning", icon: AlertTriangleIcon },
	interrupted: { label: "已中断", tone: "warning", icon: AlertTriangleIcon },
};

const PRIORITY_TONE: Record<string, string> = {
	P0: "text-destructive bg-destructive/10",
	P1: "text-warning bg-warning/10",
	P2: "text-info bg-info/10",
	P3: "text-muted-foreground bg-muted",
};

export type TaskColumnDeps = {
	/** 状态中文名（来自 /tasks/meta，缺省用内置兜底） */
	statusLabel?: (status: TaskStatusKey) => string;
	queueLabel: (queue: string) => string;
	typeLabel: (type: string) => string;
	/** 优先级（P0–P3）；返回 null 表示不展示 */
	priorityOf?: (row: TaskRow) => string | null;
	/** SLA 状态与相对文案（由 lib/admin/tasks/sla 提供） */
	slaState: (row: TaskRow) => "normal" | "due-soon" | "overdue" | "stalled";
	slaText: (row: TaskRow) => string | null;
	duration: (row: TaskRow) => string;
	relativeTime: (value: string) => string;
	absoluteTime: (value: string) => string;
};

/** 行级样式：逾期/滞留只在左侧加色条，不改字号行高，避免列表跳动。 */
export function taskRowClassName(
	row: TaskRow,
	deps: Pick<TaskColumnDeps, "slaState">,
): string | undefined {
	const state = deps.slaState(row);
	if (state === "overdue") {
		return "bg-destructive/[0.04] shadow-[inset_2px_0_0_0_var(--destructive)]";
	}
	if (state === "stalled") {
		return "bg-warning/[0.05] shadow-[inset_2px_0_0_0_var(--warning)]";
	}
	return undefined;
}

/** id 尾 6 位：完整 id 太长，列表里只留可辨识后缀，完整值走详情/Tooltip。 */
function shortId(id: string): string {
	if (id.length <= 14) return id;
	return `…${id.slice(-10)}`;
}

/** 触发来源：当前表没有 triggeredBy 字段，用 id 前缀做启发式判定（H4）。 */
export function sourceLabel(row: Pick<TaskRow, "id">): string {
	if (row.id.startsWith("cron:")) return "定时调度";
	if (row.id.startsWith("sync:")) return "本地同步执行";
	return "手动触发";
}

export function JobStatusPill({ status }: { status: TaskStatusKey }) {
	const config = STATUS_FALLBACK[status] ?? STATUS_FALLBACK.queued;
	return (
		<StatusPill
			tone={config.tone}
			icon={config.icon}
			spin={status === "running"}
		>
			{config.label}
		</StatusPill>
	);
}

function isTerminal(status: TaskStatusKey): boolean {
	return ["completed", "failed", "dead-letter", "interrupted"].includes(status);
}

/**
 * 列 registry（工厂）。
 *
 * 用工厂而不是常量，是为了把「标签 / SLA / 时间格式化」这些依赖从状态层注入，
 * 展示组件不直接 import lib/admin/tasks/*，方便单测与复用。
 *
 * 排序 id 必须落在后端白名单内（createdAt/startedAt/finishedAt/status/type），
 * 所以「耗时」列的 id 用 startedAt（显示耗时、按开始时间排）。
 */
export function createTaskColumns(
	deps: TaskColumnDeps,
): AdminColumn<TaskRow>[] {
	const labelOf = (status: TaskStatusKey) =>
		deps.statusLabel?.(status) ?? STATUS_FALLBACK[status]?.label ?? status;

	return [
		{
			id: "task",
			label: "任务",
			header: "任务",
			mobile: "title",
			cell: (row): ReactNode => (
				<div className="flex flex-col gap-0.5 min-w-0 max-w-72">
					<span className="text-sm font-medium truncate">
						{deps.typeLabel(row.type)}
					</span>
					<span className="font-mono text-[11px] text-muted-foreground truncate">
						{shortId(row.id)} · {sourceLabel(row)}
					</span>
					{row.status === "failed" && row.error && (
						<span className="text-[11px] truncate text-destructive">
							{row.error}
						</span>
					)}
				</div>
			),
		},
		{
			id: "status",
			label: "状态",
			header: "状态",
			sortable: true,
			mobile: "meta",
			cell: (row): ReactNode => {
				const state = deps.slaState(row);
				return (
					<div className="flex flex-col gap-0.5">
						<StatusPill
							tone={STATUS_FALLBACK[row.status]?.tone ?? "neutral"}
							icon={STATUS_FALLBACK[row.status]?.icon ?? ClockIcon}
							spin={row.status === "running"}
						>
							{labelOf(row.status)}
						</StatusPill>
						{state === "overdue" && (
							<span className="text-[10px] font-medium text-destructive">
								{deps.slaText(row) ?? "已逾期"}
							</span>
						)}
						{state === "stalled" && (
							<span className="text-[10px] font-medium text-warning">
								{deps.slaText(row) ?? "排队过久"}
							</span>
						)}
					</div>
				);
			},
		},
		{
			id: "queue",
			label: "队列",
			header: "队列",
			sortable: true,
			hideBelow: "md",
			mobile: "meta",
			cell: (row) => (
				<Badge variant="secondary" className="font-normal">
					{deps.queueLabel(row.queue)}
				</Badge>
			),
		},
		{
			id: "progress",
			label: "进度",
			header: "进度",
			mobile: "body",
			cell: (row) =>
				isTerminal(row.status) ? (
					<span className="text-xs text-muted-foreground">—</span>
				) : (
					<div className="flex gap-2 items-center w-32">
						<Progress value={row.progress} className="flex-1 h-1.5" />
						<span className="w-8 text-[11px] tabular-nums text-right text-muted-foreground">
							{row.progress}%
						</span>
					</div>
				),
		},
		{
			id: "startedAt",
			label: "耗时",
			header: "耗时",
			sortable: true,
			hideBelow: "lg",
			mobile: "meta",
			cell: (row) => (
				<span className="text-xs tabular-nums text-muted-foreground">
					{deps.duration(row)}
				</span>
			),
		},
		{
			id: "createdAt",
			label: "创建时间",
			header: "创建时间",
			sortable: true,
			mobile: "meta",
			mobileCell: (row) => (
				<span className="text-muted-foreground">
					{deps.relativeTime(row.createdAt)}
				</span>
			),
			cell: (row) => (
				<Tooltip>
					<TooltipTrigger
						render={
							<span className="text-xs whitespace-nowrap text-muted-foreground" />
						}
					>
						{deps.relativeTime(row.createdAt)}
					</TooltipTrigger>
					<TooltipContent>{deps.absoluteTime(row.createdAt)}</TooltipContent>
				</Tooltip>
			),
		},
		{
			id: "priority",
			label: "优先级",
			header: "优先级",
			sortable: true,
			defaultHidden: true,
			mobile: "hidden",
			cell: (row) => {
				const priority = deps.priorityOf?.(row) ?? null;
				if (!priority)
					return <span className="text-xs text-muted-foreground">—</span>;
				return (
					<span
						className={cn(
							"inline-flex px-1.5 py-0.5 text-[11px] font-medium rounded-md",
							PRIORITY_TONE[priority] ?? PRIORITY_TONE.P3,
						)}
					>
						{priority}
					</span>
				);
			},
		},
		{
			id: "source",
			label: "触发来源",
			header: "来源",
			defaultHidden: true,
			mobile: "hidden",
			cell: (row) => (
				<span className="text-xs text-muted-foreground">
					{sourceLabel(row)}
				</span>
			),
		},
		{
			id: "sla",
			label: "截止 / SLA",
			header: "截止",
			defaultHidden: true,
			mobile: "hidden",
			cell: (row) => {
				const text = deps.slaText(row);
				const state = deps.slaState(row);
				if (!text)
					return <span className="text-xs text-muted-foreground">—</span>;
				return (
					<span
						className={cn(
							"text-xs tabular-nums",
							state === "overdue"
								? "text-destructive"
								: "text-muted-foreground",
						)}
					>
						{text}
					</span>
				);
			},
		},
	];
}
