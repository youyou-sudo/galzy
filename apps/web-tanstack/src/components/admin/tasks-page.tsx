import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminPageHeader } from "@web/components/admin/admin-page-header";
import { Button } from "@web/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@web/components/ui/card";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "@web/components/ui/drawer";
import { Progress } from "@web/components/ui/progress";
import { cn } from "@web/lib/utils";
import {
	enqueueTask,
	getTaskLogs,
	listDeadLetterTasks,
	republishDeadLetterTask,
	listTasks,
	type QueueJobLogRow,
	type QueueJobRow,
	type DeadLetterJobRow,
} from "@web/server/admin/tasks";
import {
	AlertTriangleIcon,
	CheckCircleIcon,
	ClockIcon,
	ListTodoIcon,
	Loader2Icon,
	PlayIcon,
	RefreshCwIcon,
	XCircleIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ─── 标签映射 ──────────────────────────────────────────────────

const queueLabels: Record<string, string> = {
	"galzy:vndb-sync": "VNDB 同步",
	"galzy:meili-index": "Meili 索引",
	"galzy:cloudreve-sync": "Cloudreve 同步",
	"galzy:metrics": "指标/清理",
};

const typeLabels: Record<string, string> = {
	"vndb-full": "全量同步",
	"vndb-delta": "增量同步",
	"vndb-producers": "开发者同步",
	"meili-game": "游戏索引",
	"meili-tag": "标签索引",
	"meili-producer": "厂商索引",
	"cloudreve-sync": "文件同步",
	"worker-data-pull": "指标拉取",
	"queue-log-prune": "日志清理",
};

const statusConfig: Record<
	QueueJobRow["status"],
	{ label: string; className: string; icon: typeof ClockIcon }
> = {
	queued: {
		label: "排队中",
		className: "bg-muted text-muted-foreground",
		icon: ClockIcon,
	},
	running: {
		label: "运行中",
		className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
		icon: Loader2Icon,
	},
	completed: {
		label: "已完成",
		className: "bg-green-500/10 text-green-600 dark:text-green-400",
		icon: CheckCircleIcon,
	},
	failed: {
		label: "失败",
		className: "bg-red-500/10 text-red-600 dark:text-red-400",
		icon: XCircleIcon,
	},
	"dead-letter": {
		label: "死信",
		className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
		icon: AlertTriangleIcon,
	},
	interrupted: {
		label: "已中断",
		className: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
		icon: AlertTriangleIcon,
	},
};

const logLevelConfig: Record<
	QueueJobLogRow["level"],
	{
		icon: typeof CheckCircleIcon | typeof AlertTriangleIcon | null;
		className: string;
	}
> = {
	info: { icon: null, className: "text-muted-foreground" },
	warn: {
		icon: AlertTriangleIcon,
		className: "text-amber-600 dark:text-amber-400",
	},
	success: {
		icon: CheckCircleIcon,
		className: "text-green-600 dark:text-green-400",
	},
	error: { icon: XCircleIcon, className: "text-red-600 dark:text-red-400" },
};

function formatTime(iso: string | null | undefined): string {
	if (!iso) return "-";
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
}

function StatusPill({ status }: { status: QueueJobRow["status"] }) {
	const c = statusConfig[status] ?? statusConfig.queued;
	const Icon = c.icon;
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
				c.className,
			)}
		>
			<Icon className={cn("size-3", status === "running" && "animate-spin")} />
			{c.label}
		</span>
	);
}

// ─── 手动入队预设 ─────────────────────────────────────────────

const enqueuePresets: Array<{ queue: string; type: string; label: string }> = [
	{ queue: "galzy:vndb-sync", type: "vndb-full", label: "VNDB 全量同步" },
	{ queue: "galzy:vndb-sync", type: "vndb-delta", label: "VNDB 增量同步" },
	{ queue: "galzy:vndb-sync", type: "vndb-producers", label: "开发者同步" },
	{ queue: "galzy:meili-index", type: "meili-game", label: "游戏索引" },
	{ queue: "galzy:meili-index", type: "meili-tag", label: "标签索引" },
	{ queue: "galzy:meili-index", type: "meili-producer", label: "厂商索引" },
	{
		queue: "galzy:cloudreve-sync",
		type: "cloudreve-sync",
		label: "Cloudreve 同步",
	},
	{ queue: "galzy:metrics", type: "worker-data-pull", label: "指标拉取" },
];

// ─── 任务详情（Drawer）────────────────────────────────────────

function TaskDetailDrawer({
	job,
	onClose,
}: {
	job: QueueJobRow | null;
	onClose: () => void;
}) {
	const logsQuery = useQuery({
		queryKey: ["admin", "tasks", "logs", job?.id],
		queryFn: () =>
			getTaskLogs({
				data: { jobId: job?.id ?? "", pageSize: 200, pageIndex: 0 },
			}),
		enabled: !!job,
		refetchInterval: job && job.status === "running" ? 2000 : false,
	});

	if (!job) return null;

	const logs = logsQuery.data ?? [];
	const payloadType = job.type ? (typeLabels[job.type] ?? job.type) : "-";

	return (
		<Drawer open={!!job} onOpenChange={(open) => !open && onClose()}>
			<DrawerContent className="overflow-hidden">
				<DrawerHeader>
					<DrawerTitle className="flex items-center gap-2">
						任务详情
						<StatusPill status={job.status} />
					</DrawerTitle>
					<DrawerDescription>
						{queueLabels[job.queue] ?? job.queue} · {payloadType}
					</DrawerDescription>
				</DrawerHeader>

				<div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
					{/* 基本信息 */}
					<div className="grid grid-cols-2 gap-3 text-sm">
						<div>
							<span className="text-muted-foreground text-xs">队列</span>
							<p className="font-medium">
								{queueLabels[job.queue] ?? job.queue}
							</p>
						</div>
						<div>
							<span className="text-muted-foreground text-xs">类型</span>
							<p className="font-medium">{payloadType}</p>
						</div>
						<div>
							<span className="text-muted-foreground text-xs">任务 ID</span>
							<p className="font-mono text-xs break-all">{job.id}</p>
						</div>
						<div>
							<span className="text-muted-foreground text-xs">创建时间</span>
							<p className="font-medium">{formatTime(job.createdAt)}</p>
						</div>
						{job.startedAt && (
							<div>
								<span className="text-muted-foreground text-xs">开始</span>
								<p className="font-medium">{formatTime(job.startedAt)}</p>
							</div>
						)}
						{job.finishedAt && (
							<div>
								<span className="text-muted-foreground text-xs">结束</span>
								<p className="font-medium">{formatTime(job.finishedAt)}</p>
							</div>
						)}
					</div>

					{/* 进度 */}
					<div className="space-y-2">
						<div className="flex items-center justify-between text-xs text-muted-foreground">
							<span>进度</span>
							<span>{job.progress}%</span>
						</div>
						<Progress value={job.progress} />
					</div>

					{/* 错误 */}
					{job.error && (
						<div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-600 dark:text-red-400">
							<p className="font-medium flex items-center gap-1">
								<XCircleIcon className="size-4" />
								失败原因
							</p>
							<p className="mt-1 break-all whitespace-pre-wrap">{job.error}</p>
						</div>
					)}

					{/* 结果 */}
					{job.result && (
						<div className="rounded-lg bg-muted p-3 text-xs">
							<p className="font-medium text-muted-foreground mb-1">结果</p>
							<pre className="break-all whitespace-pre-wrap font-mono">
								{JSON.stringify(job.result, null, 2)}
							</pre>
						</div>
					)}

					{/* 日志 */}
					<div>
						<p className="text-sm font-medium mb-2">执行日志</p>
						{logsQuery.isLoading ? (
							<div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
								<Loader2Icon className="size-4 animate-spin" />
								加载中...
							</div>
						) : logs.length > 0 ? (
							<div className="rounded-lg bg-muted p-3 max-h-80 overflow-y-auto font-mono text-xs space-y-1">
								{logs.map((log) => {
									const lc = logLevelConfig[log.level] ?? logLevelConfig.info;
									const LIcon = lc.icon;
									return (
										<div
											key={log.id}
											className={cn("flex items-start gap-1.5", lc.className)}
										>
											<span className="text-muted-foreground/60 shrink-0">
												{new Date(log.createdAt).toLocaleTimeString()}
											</span>
											{LIcon && <LIcon className="size-3 shrink-0 mt-0.5" />}
											<span className="break-all">{log.message}</span>
										</div>
									);
								})}
							</div>
						) : (
							<p className="text-sm text-muted-foreground">暂无日志</p>
						)}
					</div>
				</div>
			</DrawerContent>
		</Drawer>
	);
}

// ─── 主页面 ───────────────────────────────────────────────────

export default function TasksPage() {
	const queryClient = useQueryClient();
	const [selectedJob, setSelectedJob] = useState<QueueJobRow | null>(null);

	const {
		data: jobs,
		isLoading,
		refetch,
	} = useQuery({
		queryKey: ["admin", "tasks", "list"],
		queryFn: () => listTasks({ data: { pageSize: 50, pageIndex: 0 } }),
		refetchInterval: 3000,
	});

	const enqueueMutation = useMutation({
		mutationFn: (preset: { queue: string; type: string; label: string }) =>
			enqueueTask({ data: { queue: preset.queue, type: preset.type } }),
		onSuccess: (_, preset) => {
			toast.success(`${preset.label} 已入队`);
			queryClient.invalidateQueries({ queryKey: ["admin", "tasks", "list"] });
		},
		onError: (e) => {
			toast.error(`入队失败: ${e instanceof Error ? e.message : String(e)}`);
		},
	});

	// 点击任务行 → 打开详情（并预取详情）
	const openDetail = (job: QueueJobRow) => {
		setSelectedJob(job);
	};

	const hasRunning = jobs?.some(
		(j) => j.status === "running" || j.status === "queued",
	);

	return (
		<div className="flex flex-col gap-6">
			<AdminPageHeader
				eyebrow="系统"
				title="任务队列"
				description="监控后台同步任务（VNDB / Meilisearch / Cloudreve）的执行状态、进度与日志"
				actions={
					<Button variant="outline" size="sm" onClick={() => refetch()}>
						<RefreshCwIcon className="size-4" />
						刷新
					</Button>
				}
			/>

			{/* 手动入队 */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<PlayIcon className="size-5" />
						手动触发任务
					</CardTitle>
					<CardDescription>
						选择一个任务入队执行，任务将按队列串行/并行消费
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-wrap gap-2">
						{enqueuePresets.map((preset) => (
							<Button
								key={`${preset.queue}-${preset.type}`}
								variant="outline"
								size="sm"
								disabled={enqueueMutation.isPending}
								onClick={() => enqueueMutation.mutate(preset)}
							>
								{enqueueMutation.isPending ? (
									<Loader2Icon className="size-3.5 animate-spin" />
								) : (
									<PlayIcon className="size-3.5" />
								)}
								{preset.label}
							</Button>
						))}
					</div>
				</CardContent>
			</Card>

			{/* 任务列表 */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<ListTodoIcon className="size-5" />
						最近任务
						{hasRunning && (
							<span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
								<Loader2Icon className="size-3 animate-spin" />
								有任务进行中
							</span>
						)}
					</CardTitle>
					<CardDescription>点击任务查看详情、进度与执行日志</CardDescription>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
							<Loader2Icon className="size-5 animate-spin" />
							加载中...
						</div>
					) : !jobs || jobs.length === 0 ? (
						<p className="text-sm text-muted-foreground py-8 text-center">
							暂无任务记录。手动触发一个任务，或等待定时任务执行。
						</p>
					) : (
						<div className="space-y-2">
							{jobs.map((job) => (
								<button
									key={job.id}
									type="button"
									onClick={() => openDetail(job)}
									className={cn(
										"w-full flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-lg border text-left transition-colors hover:bg-muted/50",
									)}
								>
									<div className="flex items-center gap-2 sm:w-40 shrink-0">
										<StatusPill status={job.status} />
									</div>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium truncate">
											{queueLabels[job.queue] ?? job.queue}
											<span className="text-muted-foreground"> · </span>
											{typeLabels[job.type] ?? job.type}
										</p>
										<p className="text-xs text-muted-foreground font-mono truncate">
											{job.id}
										</p>
									</div>
									<div className="flex items-center gap-3 shrink-0">
										<div className="w-24">
											<Progress value={job.progress} className="h-2" />
										</div>
										<span className="text-xs text-muted-foreground tabular-nums w-8 text-right">
											{job.progress}%
										</span>
										<span className="text-xs text-muted-foreground w-32 text-right">
											{formatTime(job.createdAt)}
										</span>
									</div>
								</button>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			<TaskDetailDrawer
				job={selectedJob}
				onClose={() => setSelectedJob(null)}
			/>
		</div>
	);
}
