import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import { Skeleton } from "@web/components/ui/skeleton";
import { cn } from "@web/lib/utils";
import { AlertTriangleIcon, ChevronDownIcon } from "lucide-react";
import { useState } from "react";

/** 单条队列的实时计数（/tasks/queues 的一行）。 */
export type TaskQueueStat = {
	queue: string;
	waiting: number;
	active: number;
	completed: number;
	failed: number;
	delayed: number;
	paused: number;
};

export type TaskQueueLanesProps = {
	queues: TaskQueueStat[];
	/** 已生效的队列筛选（多选） */
	activeQueues: string[];
	onToggle: (queue: string) => void;
	/** 打开该队列的死信抽屉 */
	onOpenDeadLetter: (queue: string) => void;
	/** 队列键 → 中文名（来自 /tasks/meta），缺省回退原始键 */
	labels: Record<string, string>;
	/** 首次加载：显示摘要骨架，而不是整块消失 */
	isLoading?: boolean;
	className?: string;
};

function QueueCard({
	stat,
	label,
	active,
	onToggle,
	onOpenDeadLetter,
}: {
	stat: TaskQueueStat;
	label: string;
	active: boolean;
	onToggle: (queue: string) => void;
	onOpenDeadLetter: (queue: string) => void;
}) {
	const backlog = stat.active + stat.waiting + stat.delayed;
	const activeRatio =
		backlog === 0 ? 0 : Math.round((stat.active / backlog) * 100);
	const visibleWorkers = stat.active > 0;

	return (
		<div
			className={cn(
				"relative bg-card rounded-xl ring-1 transition-colors",
				active ? "ring-2 ring-primary" : "ring-border/60 hover:ring-border",
			)}
		>
			{/* 整卡即队列筛选开关；死信按钮绝对定位浮在右上角，
			    避免 button 套 button 的无效结构 */}
			<button
				type="button"
				aria-pressed={active}
				onClick={() => onToggle(stat.queue)}
				className={cn(
					"flex flex-col gap-2 p-3 w-full text-left rounded-xl transition-colors",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
					stat.failed > 0 && "pr-28",
				)}
			>
				<span className="flex gap-2 items-center min-w-0">
					<span
						className={cn(
							"shrink-0 rounded-full size-1.5",
							visibleWorkers
								? "bg-success animate-pulse"
								: stat.waiting + stat.delayed > 0
									? "bg-warning"
									: "bg-neutral/60",
						)}
					/>
					<span className="text-sm font-medium truncate">{label}</span>
					{stat.paused > 0 && (
						<Badge variant="outline" className="font-normal shrink-0">
							已暂停
						</Badge>
					)}
					{active && (
						<span className="ml-auto text-[10px] font-medium text-primary shrink-0">
							筛选中
						</span>
					)}
				</span>

				<span className="flex overflow-hidden h-1.5 bg-muted rounded-full">
					<span
						className="bg-info transition-[width] duration-500"
						style={{ width: `${activeRatio}%` }}
					/>
				</span>

				<span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
					<span className="tabular-nums">
						运行{" "}
						<span className="font-medium text-foreground">{stat.active}</span>
					</span>
					<span className="tabular-nums">
						等待{" "}
						<span className="font-medium text-foreground">{stat.waiting}</span>
					</span>
					{stat.delayed > 0 && (
						<span className="tabular-nums">
							延迟{" "}
							<span className="font-medium text-foreground">
								{stat.delayed}
							</span>
						</span>
					)}
					<span className="ml-auto tabular-nums">
						完成 {stat.completed.toLocaleString()}
					</span>
				</span>
			</button>

			{stat.failed > 0 && (
				<Button
					variant="destructive"
					size="xs"
					onClick={() => onOpenDeadLetter(stat.queue)}
					className="absolute top-2 right-2 z-10 gap-1"
					title={`查看「${label}」的死信任务`}
				>
					<AlertTriangleIcon className="size-3" />
					死信 {stat.failed}
				</Button>
			)}
		</div>
	);
}

/**
 * 队列泳道：默认折叠成一行摘要（运行 / 等待 / 死信合计），展开后每队列一张卡。
 *
 * 折叠是有意为之——任务页首屏的主角是列表，队列统计是次要信息；
 * 展开状态留在组件内部（useState），不进 URL，因为它是纯视图偏好。
 */
export function TaskQueueLanes({
	queues,
	activeQueues,
	onToggle,
	onOpenDeadLetter,
	labels,
	isLoading = false,
	className,
}: TaskQueueLanesProps) {
	const [expanded, setExpanded] = useState(false);

	// 首次加载：一行摘要骨架，保持首屏结构稳定；加载完且真的没有队列才隐藏
	if (isLoading && queues.length === 0) {
		return (
			<div
				className={cn(
					"flex flex-wrap gap-2 items-center p-2 bg-card rounded-xl ring-1 ring-border/60",
					className,
				)}
				aria-busy="true"
			>
				<span className="px-1.5 text-xs font-medium text-muted-foreground">
					队列概览
				</span>
				<Skeleton className="w-32 h-3.5" />
				<Skeleton className="ml-auto w-16 h-3" />
			</div>
		);
	}

	if (queues.length === 0) return null;

	const totals = queues.reduce(
		(acc, stat) => ({
			active: acc.active + stat.active,
			waiting: acc.waiting + stat.waiting,
			failed: acc.failed + stat.failed,
		}),
		{ active: 0, waiting: 0, failed: 0 },
	);

	return (
		<div className={cn("flex flex-col gap-2", className)}>
			<div className="flex flex-wrap gap-2 items-center p-2 bg-card rounded-xl ring-1 ring-border/60">
				<button
					type="button"
					aria-expanded={expanded}
					onClick={() => setExpanded((value) => !value)}
					className="flex gap-1.5 items-center px-1.5 h-7 text-xs font-medium rounded-lg transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
				>
					<ChevronDownIcon
						className={cn(
							"size-3.5 text-muted-foreground transition-transform",
							expanded && "rotate-180",
						)}
					/>
					队列概览
				</button>

				<span className="text-xs tabular-nums text-muted-foreground">
					运行{" "}
					<span className="font-medium text-foreground">{totals.active}</span>
					{" · "}等待{" "}
					<span className="font-medium text-foreground">{totals.waiting}</span>
					{totals.failed > 0 && (
						<>
							{" · "}
							<span className="text-destructive">死信 {totals.failed}</span>
						</>
					)}
				</span>

				{activeQueues.length > 0 && (
					<Badge variant="secondary" className="font-normal">
						已选 {activeQueues.length} 个队列
					</Badge>
				)}

				<span className="ml-auto text-[11px] text-muted-foreground">
					{queues.length} 个队列
				</span>
			</div>

			{expanded && (
				<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
					{queues.map((stat) => (
						<QueueCard
							key={stat.queue}
							stat={stat}
							label={labels[stat.queue] ?? stat.queue}
							active={activeQueues.includes(stat.queue)}
							onToggle={onToggle}
							onOpenDeadLetter={onOpenDeadLetter}
						/>
					))}
				</div>
			)}
		</div>
	);
}
