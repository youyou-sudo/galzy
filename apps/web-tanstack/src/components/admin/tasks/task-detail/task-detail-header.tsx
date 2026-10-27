import { StatusPill } from "@web/components/admin/admin-table";
import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import { Skeleton } from "@web/components/ui/skeleton";
import {
	queueLabel,
	statusLabel,
	TASK_STATUS_TONE,
	taskTypeLabel,
} from "@web/lib/admin/tasks/labels";
import { cn } from "@web/lib/utils";
import {
	AlertTriangleIcon,
	CheckCircleIcon,
	ClockIcon,
	CopyIcon,
	Loader2Icon,
	type LucideIcon,
	XCircleIcon,
	XIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { TaskRow, TaskStatusKey } from "../types";

/**
 * 详情抽屉头部：状态 / 队列 / 类型 / 任务 ID（可复制）/ 关闭。
 *
 * 只做展示，不取数——数据来自 `TaskDetailSheet` 的 getTaskDetail 查询，
 * 这样「直接访问 ?job=xxx」（该行不在当前页）也能正常渲染。
 */

const STATUS_ICONS: Record<TaskStatusKey, LucideIcon> = {
	queued: ClockIcon,
	running: Loader2Icon,
	completed: CheckCircleIcon,
	failed: XCircleIcon,
	"dead-letter": AlertTriangleIcon,
	interrupted: AlertTriangleIcon,
};

export type TaskDetailHeaderProps = {
	job: TaskRow | null;
	/** 轮询刷新中：状态点脉冲提示（不改变布局） */
	isFetching?: boolean;
	onClose: () => void;
	className?: string;
};

export function TaskDetailHeader({
	job,
	isFetching = false,
	onClose,
	className,
}: TaskDetailHeaderProps) {
	const copyId = async (id: string) => {
		try {
			await navigator.clipboard.writeText(id);
			toast.success("任务 ID 已复制");
		} catch {
			toast.error("复制失败");
		}
	};

	if (!job) {
		return (
			<div className={cn("flex gap-2 justify-between items-start", className)}>
				<div className="flex flex-col gap-1.5 w-full min-w-0">
					<Skeleton className="h-5 w-28" />
					<Skeleton className="h-4 w-44" />
					<Skeleton className="h-3 w-56" />
				</div>
				<Button
					variant="ghost"
					size="icon-xs"
					aria-label="关闭详情"
					onClick={onClose}
				>
					<XIcon className="size-3.5" />
				</Button>
			</div>
		);
	}

	return (
		<div className={cn("flex gap-2 justify-between items-start", className)}>
			<div className="flex flex-col gap-1 min-w-0">
				<div className="flex flex-wrap gap-1.5 items-center">
					<StatusPill
						tone={TASK_STATUS_TONE[job.status]}
						icon={STATUS_ICONS[job.status]}
						spin={job.status === "running"}
					>
						{statusLabel(job.status)}
					</StatusPill>
					<Badge variant="secondary">{queueLabel(job.queue)}</Badge>
					{isFetching && (
						<span
							aria-hidden
							className="size-1.5 bg-info rounded-full animate-pulse"
						/>
					)}
				</div>
				<h2 className="text-sm font-semibold truncate">
					{taskTypeLabel(job.type)}
				</h2>
				<button
					type="button"
					onClick={() => void copyId(job.id)}
					aria-label={`复制任务 ID：${job.id}`}
					className="flex gap-1 items-center max-w-full text-[11px] text-muted-foreground rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
				>
					<span className="font-mono truncate">{job.id}</span>
					<CopyIcon className="size-3 shrink-0" />
				</button>
			</div>
			<Button
				variant="ghost"
				size="icon-xs"
				aria-label="关闭详情"
				onClick={onClose}
				className="text-muted-foreground"
			>
				<XIcon className="size-3.5" />
			</Button>
		</div>
	);
}
