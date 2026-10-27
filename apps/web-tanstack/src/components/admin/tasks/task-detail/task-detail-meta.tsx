import { Button } from "@web/components/ui/button";
import { Progress } from "@web/components/ui/progress";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@web/components/ui/tooltip";
import { formatDuration, formatRelativeTime } from "@web/lib/admin/optimistic";
import {
	overdueFor,
	type SlaState,
	slaDueAt,
	slaLabel,
	slaState,
} from "@web/lib/admin/tasks/sla";
import { cn } from "@web/lib/utils";
import {
	AlertTriangleIcon,
	ClockIcon,
	CopyIcon,
	FlagIcon,
	PlayIcon,
	XCircleIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { TaskRow } from "../types";

/**
 * 详情抽屉的「时间线 + 进度 + SLA + 失败原因」区块。
 *
 * SLA 判定复用 `lib/admin/tasks/sla` 的纯函数（与列表行染色同源，不另写一套）：
 * 非终态且超过 startedAt + 该类型预期耗时 → 逾期；queued 超过 createdAt + 10min
 * → 滞留；运行时长超过预期 2 倍 → 疑似卡死；终态永不逾期。
 */

/** SLA 文案需要随运行时长推进，30s 刷新一次就够（不引入秒级重渲染）。 */
const NOW_TICK_MS = 30_000;

function absoluteTime(input: string | number | null | undefined): string {
	if (input === null || input === undefined) return "-";
	const date = new Date(input);
	if (Number.isNaN(date.getTime())) return "-";
	return date.toLocaleString("zh-CN", { hour12: false });
}

const SLA_BANNERS: Record<
	Exclude<SlaState, "normal">,
	{ className: string; icon: typeof AlertTriangleIcon }
> = {
	"due-soon": {
		className: "bg-warning/10 text-warning ring-warning/20",
		icon: ClockIcon,
	},
	overdue: {
		className: "bg-destructive/10 text-destructive ring-destructive/20",
		icon: AlertTriangleIcon,
	},
	stalled: {
		className: "bg-warning/10 text-warning ring-warning/20",
		icon: AlertTriangleIcon,
	},
};

export type TaskDetailMetaProps = {
	job: TaskRow | null;
	className?: string;
};

export function TaskDetailMeta({ job, className }: TaskDetailMetaProps) {
	const [now, setNow] = useState<number>(() => Date.now());

	useEffect(() => {
		setNow(Date.now());
		const timer = window.setInterval(() => setNow(Date.now()), NOW_TICK_MS);
		return () => window.clearInterval(timer);
	}, []);

	const sla = useMemo<SlaState>(
		() => (job ? slaState(job, now) : "normal"),
		[job, now],
	);

	if (!job) return null;

	// overdueFor 已是中文文案（未超时「剩余 X」/ 已超时「已超时 X」），直接用
	const slaGap = overdueFor(job, now);
	const dueAt = slaDueAt(job);
	const banner = sla === "normal" ? null : SLA_BANNERS[sla];

	const slaHint =
		sla === "stalled"
			? "运行时长已超过预期耗时的 2 倍，可能卡住"
			: (slaGap ?? "已超出预期耗时");

	const copyError = async () => {
		if (!job.error) return;
		try {
			await navigator.clipboard.writeText(job.error);
			toast.success("失败原因已复制");
		} catch {
			toast.error("复制失败");
		}
	};

	return (
		<div className={cn("flex flex-col gap-3", className)}>
			<div className="flex flex-col gap-1.5">
				<div className="flex justify-between items-center text-[11px] text-muted-foreground">
					<span>执行进度</span>
					<span className="font-medium text-foreground tabular-nums">
						{job.progress}%
					</span>
				</div>
				<Progress value={job.progress} className="h-1.5" />
			</div>

			<div className="grid grid-cols-2 gap-x-3 gap-y-2.5 p-3 bg-muted/40 rounded-xl">
				<TimelineItem
					label="创建时间"
					icon={ClockIcon}
					value={formatRelativeTime(job.createdAt)}
					absolute={absoluteTime(job.createdAt)}
				/>
				<TimelineItem
					label="开始时间"
					icon={PlayIcon}
					value={job.startedAt ? formatRelativeTime(job.startedAt) : "未开始"}
					absolute={absoluteTime(job.startedAt)}
				/>
				<TimelineItem
					label="结束时间"
					icon={FlagIcon}
					value={job.finishedAt ? formatRelativeTime(job.finishedAt) : "进行中"}
					absolute={absoluteTime(job.finishedAt)}
				/>
				<TimelineItem
					label="耗时"
					icon={ClockIcon}
					value={formatDuration(job.startedAt, job.finishedAt)}
					absolute={`${absoluteTime(job.startedAt)} → ${absoluteTime(job.finishedAt)}`}
				/>
			</div>

			{banner && (
				<div
					className={cn(
						"flex gap-2 items-start p-2.5 text-xs rounded-xl ring-1",
						banner.className,
					)}
				>
					<banner.icon className="shrink-0 mt-0.5 size-3.5" />
					<div className="flex flex-col gap-0.5 min-w-0">
						<span className="font-medium">{slaLabel(sla)}</span>
						<span className="text-muted-foreground">{slaHint}</span>
						{dueAt !== null && (
							<span className="text-muted-foreground/80">
								预计截止 {absoluteTime(dueAt)}
							</span>
						)}
					</div>
				</div>
			)}

			{job.error && (
				<div className="p-2.5 text-xs text-destructive bg-destructive/10 rounded-xl ring-1 ring-destructive/20">
					<div className="flex gap-1 items-center font-medium">
						<XCircleIcon className="size-3.5 shrink-0" />
						失败原因
						<Button
							variant="ghost"
							size="icon-xs"
							aria-label="复制失败原因"
							onClick={() => void copyError()}
							className="ml-auto text-destructive"
						>
							<CopyIcon className="size-3" />
						</Button>
					</div>
					<p className="mt-1 break-all whitespace-pre-wrap">{job.error}</p>
				</div>
			)}
		</div>
	);
}

function TimelineItem({
	label,
	icon: Icon,
	value,
	absolute,
}: {
	label: string;
	icon: typeof ClockIcon;
	value: string;
	absolute: string;
}) {
	return (
		<div className="flex gap-1.5 items-start min-w-0">
			<Icon className="shrink-0 mt-0.5 size-3 text-muted-foreground" />
			<div className="flex flex-col min-w-0">
				<span className="text-[11px] text-muted-foreground">{label}</span>
				<Tooltip>
					<TooltipTrigger
						render={<span className="text-xs font-medium truncate" />}
					>
						{value}
					</TooltipTrigger>
					<TooltipContent>{absolute}</TooltipContent>
				</Tooltip>
			</div>
		</div>
	);
}
