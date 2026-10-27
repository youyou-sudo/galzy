import { IconTile } from "@web/components/shared/icon-tile";
import { Skeleton } from "@web/components/ui/skeleton";
import { cn } from "@web/lib/utils";
import {
	AlertTriangleIcon,
	ClockIcon,
	HistoryIcon,
	Loader2Icon,
	XCircleIcon,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

type IconTileProps = ComponentProps<typeof IconTile>;

type OverviewMetric = {
	/** 对应的状态键；"total" 表示不可点击的记录总数 */
	key: string;
	label: string;
	icon: IconTileProps["icon"];
	tone: IconTileProps["tone"];
	value: number;
};

export type TaskOverviewBarProps = {
	/** 各状态计数（/tasks/stats 的 counts），缺省按 0 展示 */
	counts?: Record<string, number>;
	/** 当前筛选条件下的记录总数 */
	total: number;
	/** 已生效的状态筛选（与状态分段控件同一份状态） */
	activeStatuses: string[];
	onToggle: (status: string) => void;
	/** 队列泳道插槽（task-queue-lanes），由页面决定是否渲染 */
	queueLanes?: ReactNode;
	/** 首屏列表还在加载：数字位置显示骨架，而不是误导性的 0 */
	isLoading?: boolean;
	className?: string;
};

/**
 * 概览条：4 个可点击指标 + 记录总数。
 *
 * 指标与「状态分段控件」共用 activeStatuses/onToggle，所以点卡片和点分段项
 * 是同一个动作，不会出现两套筛选状态互相覆盖。窄屏横向滚动不换行，
 * 避免 KPI 换行把首屏表格挤下去。
 */
export function TaskOverviewBar({
	counts,
	total,
	activeStatuses,
	onToggle,
	queueLanes,
	isLoading = false,
	className,
}: TaskOverviewBarProps) {
	const countOf = (status: string) => counts?.[status] ?? 0;

	const metrics: OverviewMetric[] = [
		{
			key: "running",
			label: "运行中",
			icon: Loader2Icon,
			tone: "info",
			value: countOf("running"),
		},
		{
			key: "queued",
			label: "排队中",
			icon: ClockIcon,
			tone: "neutral",
			value: countOf("queued"),
		},
		{
			key: "failed",
			label: "失败",
			icon: XCircleIcon,
			tone: "destructive",
			value: countOf("failed"),
		},
		{
			key: "dead-letter",
			label: "死信",
			icon: AlertTriangleIcon,
			tone: "warning",
			value: countOf("dead-letter"),
		},
	];

	return (
		<div
			className={cn("flex flex-col gap-2", className)}
			aria-busy={isLoading || undefined}
		>
			<div className="flex gap-2 items-stretch pb-0.5 overflow-x-auto">
				{metrics.map((metric) => {
					const active = activeStatuses.includes(metric.key);
					return (
						<button
							key={metric.key}
							type="button"
							aria-pressed={active}
							onClick={() => onToggle(metric.key)}
							className={cn(
								"flex flex-1 shrink-0 gap-2.5 items-center p-2.5 min-w-33 text-left bg-card rounded-xl ring-1 transition-colors duration-150",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
								active
									? "ring-2 ring-primary bg-primary/5"
									: "ring-border/60 hover:ring-border hover:bg-muted/40",
							)}
						>
							<IconTile icon={metric.icon} size="sm" tone={metric.tone} />
							<span className="flex flex-col min-w-0">
								<span className="text-xl leading-none font-semibold tabular-nums">
									{isLoading ? (
										<Skeleton
											as="span"
											className="inline-block w-7 h-5 align-middle"
										/>
									) : (
										metric.value.toLocaleString()
									)}
								</span>
								<span className="mt-1 text-[11px] whitespace-nowrap text-muted-foreground">
									{metric.label}
								</span>
							</span>
						</button>
					);
				})}

				<div className="flex flex-1 shrink-0 gap-2.5 items-center p-2.5 min-w-33 bg-card rounded-xl ring-1 ring-border/60">
					<IconTile icon={HistoryIcon} size="sm" tone="muted" />
					<span className="flex flex-col min-w-0">
						<span className="text-xl leading-none font-semibold tabular-nums">
							{isLoading ? (
								<Skeleton
									as="span"
									className="inline-block w-7 h-5 align-middle"
								/>
							) : (
								total.toLocaleString()
							)}
						</span>
						<span className="mt-1 text-[11px] whitespace-nowrap text-muted-foreground">
							记录总数
						</span>
					</span>
				</div>
			</div>

			{queueLanes && <div className="min-w-0">{queueLanes}</div>}
		</div>
	);
}
