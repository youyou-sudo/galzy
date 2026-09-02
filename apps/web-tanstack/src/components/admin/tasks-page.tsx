import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminPageHeader } from "@web/components/admin/admin-page-header";
import { Badge } from "@web/components/ui/badge";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@web/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@web/components/ui/tabs";
import { cn } from "@web/lib/utils";
import {
	batchDeleteTasks,
	deleteTask,
	enqueueTask,
	getQueueStats,
	getTaskLogs,
	getTaskStats,
	listTasks,
	type QueueJobLogRow,
	type QueueJobRow,
	type QueueStatsRow,
	removeDeadLetterTask,
	republishDeadLetterTask,
	retryTask,
	type TaskStats,
} from "@web/server/admin/tasks";
import {
	AlertTriangleIcon,
	CheckCircleIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	ClockIcon,
	Loader2Icon,
	PlayIcon,
	RefreshCwIcon,
	RotateCcwIcon,
	Trash2Icon,
	XCircleIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ─── 标签映射 ──────────────────────────────────────────────────

const queueLabels: Record<string, string> = {
	"galzy:vndb-sync": "VNDB 同步",
	"galzy:kungal-sync": "Kungal 同步",
	"galzy:meili-index": "Meili 索引",
	"galzy:cloudreve-sync": "Cloudreve 同步",
	"galzy:metrics": "指标/清理",
};

const typeLabels: Record<string, string> = {
	"vndb-full": "VNDB 全量同步",
	"vndb-delta": "VNDB 增量同步",
	"vndb-producers": "开发者同步",
	"kungal-full": "Kungal 全量同步",
	"kungal-delta": "Kungal 增量同步",
	"meili-game": "游戏索引重建",
	"meili-tag": "标签索引重建",
	"meili-producer": "厂商索引重建",
	"cloudreve-sync": "Cloudreve 文件同步",
	"queue-log-prune": "队列日志清理",
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

/** 状态筛选 Tab 顺序与徽标颜色。 */
const statusTabs: Array<{
	key: string;
	label: string;
	icon: typeof ClockIcon;
}> = [
	{ key: "", label: "全部", icon: ClockIcon },
	{ key: "queued", label: "排队中", icon: ClockIcon },
	{ key: "running", label: "运行中", icon: Loader2Icon },
	{ key: "completed", label: "已完成", icon: CheckCircleIcon },
	{ key: "failed", label: "失败", icon: XCircleIcon },
	{ key: "dead-letter", label: "死信", icon: AlertTriangleIcon },
	{ key: "interrupted", label: "已中断", icon: AlertTriangleIcon },
];

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

// ─── 顶部统计卡 ────────────────────────────────────────────────

function StatCards({ stats }: { stats: TaskStats | undefined }) {
	const cards: Array<{
		key: string;
		label: string;
		count: number;
		className: string;
		icon: typeof ClockIcon;
	}> = [
		{
			key: "total",
			label: "全部任务",
			count: stats?.total ?? 0,
			className: "",
			icon: ClockIcon,
		},
		{
			key: "running",
			label: "运行中",
			count: stats?.counts.running ?? 0,
			className: "text-blue-600 dark:text-blue-400",
			icon: Loader2Icon,
		},
		{
			key: "queued",
			label: "排队中",
			count: stats?.counts.queued ?? 0,
			className: "text-muted-foreground",
			icon: ClockIcon,
		},
		{
			key: "completed",
			label: "已完成",
			count: stats?.counts.completed ?? 0,
			className: "text-green-600 dark:text-green-400",
			icon: CheckCircleIcon,
		},
		{
			key: "failed",
			label: "失败 / 死信",
			count: (stats?.counts.failed ?? 0) + (stats?.counts["dead-letter"] ?? 0),
			className: "text-red-600 dark:text-red-400",
			icon: XCircleIcon,
		},
	];
	return (
		<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
			{cards.map((c) => {
				const Icon = c.icon;
				return (
					<Card key={c.key}>
						<CardContent className="flex items-center gap-3 p-4">
							<Icon className={cn("size-5 shrink-0", c.className)} />
							<div>
								<p className="text-xs text-muted-foreground">{c.label}</p>
								<p className="text-2xl font-semibold tabular-nums">{c.count}</p>
							</div>
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}

// ─── 队列实时状态卡 ───────────────────────────────────────────

function QueueStatusStrip({ queues }: { queues: QueueStatsRow[] | undefined }) {
	if (!queues || queues.length === 0) return null;
	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-sm font-medium flex items-center gap-2">
					队列实时状态
				</CardTitle>
			</CardHeader>
			<CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
				{queues.map((q) => {
					const hasActive = q.active > 0;
					const hasPending = q.waiting > 0 || q.delayed > 0;
					return (
						<div
							key={q.queue}
							className="rounded-lg border p-3 flex flex-col gap-1.5"
						>
							<div className="flex items-center gap-1.5">
								<span
									className={cn(
										"size-2 rounded-full",
										hasActive
											? "bg-green-500 animate-pulse"
											: hasPending
												? "bg-amber-400"
												: "bg-muted-foreground/30",
									)}
								/>
								<span className="text-sm font-medium truncate">
									{queueLabels[q.queue] ?? q.queue}
								</span>
							</div>
							<div className="flex items-center gap-3 text-xs text-muted-foreground">
								<span>
									运行{" "}
									<span className="font-medium tabular-nums">{q.active}</span>
								</span>
								<span>
									等待{" "}
									<span className="font-medium tabular-nums">{q.waiting}</span>
								</span>
								<span>
									延迟{" "}
									<span className="font-medium tabular-nums">{q.delayed}</span>
								</span>
							</div>
						</div>
					);
				})}
			</CardContent>
		</Card>
	);
}

// ─── 任务详情（Drawer）────────────────────────────────────────

function TaskDetailDrawer({
	job,
	onClose,
	onMutated,
}: {
	job: QueueJobRow | null;
	onClose: () => void;
	onMutated: () => void;
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

	const deadLetterMutation = useMutation({
		mutationFn: ({
			queue,
			jobId,
			action,
		}: {
			queue: string;
			jobId: string;
			action: "republish" | "remove";
		}) =>
			action === "republish"
				? republishDeadLetterTask({ data: { queue, jobId } })
				: removeDeadLetterTask({ data: { queue, jobId } }),
		onSuccess: (_, { action }) => {
			toast.success(action === "republish" ? "已重放回队列" : "已丢弃死信");
			onClose();
			onMutated();
		},
		onError: (e) => {
			toast.error(`操作失败: ${e instanceof Error ? e.message : String(e)}`);
		},
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

					{/* 死信操作 */}
					{job.status === "dead-letter" && (
						<div className="flex flex-wrap gap-2">
							<Button
								size="sm"
								variant="outline"
								disabled={deadLetterMutation.isPending}
								onClick={() =>
									deadLetterMutation.mutate({
										queue: job.queue,
										jobId: job.id,
										action: "republish",
									})
								}
							>
								<RefreshCwIcon className="size-3.5" />
								重放回队列
							</Button>
							<Button
								size="sm"
								variant="destructive"
								disabled={deadLetterMutation.isPending}
								onClick={() =>
									deadLetterMutation.mutate({
										queue: job.queue,
										jobId: job.id,
										action: "remove",
									})
								}
							>
								<XCircleIcon className="size-3.5" />
								丢弃死信
							</Button>
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

// ─── 手动入队预设 ─────────────────────────────────────────────

const enqueuePresets: Array<{ queue: string; type: string; label: string }> = [
	{ queue: "galzy:vndb-sync", type: "vndb-full", label: "VNDB 全量同步" },
	{ queue: "galzy:vndb-sync", type: "vndb-delta", label: "VNDB 增量同步" },
	{ queue: "galzy:vndb-sync", type: "vndb-producers", label: "开发者同步" },
	{ queue: "galzy:kungal-sync", type: "kungal-full", label: "Kungal 全量" },
	{ queue: "galzy:kungal-sync", type: "kungal-delta", label: "Kungal 增量" },
	{ queue: "galzy:meili-index", type: "meili-game", label: "游戏索引" },
	{ queue: "galzy:meili-index", type: "meili-tag", label: "标签索引" },
	{ queue: "galzy:meili-index", type: "meili-producer", label: "厂商索引" },
	{
		queue: "galzy:cloudreve-sync",
		type: "cloudreve-sync",
		label: "Cloudreve 同步",
	},
];

// ─── 主页面 ───────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function TasksPage() {
	const queryClient = useQueryClient();
	const [selectedJob, setSelectedJob] = useState<QueueJobRow | null>(null);
	const [status, setStatus] = useState("");
	const [queue, setQueue] = useState("");
	const [page, setPage] = useState(0);

	const { data: stats } = useQuery({
		queryKey: ["admin", "tasks", "stats"],
		queryFn: () => getTaskStats(),
		refetchInterval: 5000,
	});

	const { data: queueStats } = useQuery({
		queryKey: ["admin", "tasks", "queues"],
		queryFn: () => getQueueStats(),
		refetchInterval: 3000,
	});

	const { data: list, isLoading } = useQuery({
		queryKey: ["admin", "tasks", "list", { status, queue, page }],
		queryFn: () =>
			listTasks({
				data: {
					pageSize: PAGE_SIZE,
					pageIndex: page,
					status: status || undefined,
					queue: queue || undefined,
				},
			}),
		refetchInterval: 3000,
	});

	const enqueueMutation = useMutation({
		mutationFn: (preset: { queue: string; type: string; label: string }) =>
			enqueueTask({ data: { queue: preset.queue, type: preset.type } }),
		onSuccess: (_, preset) => {
			toast.success(`${preset.label} 已入队`);
			queryClient.invalidateQueries({
				queryKey: ["admin", "tasks"],
			});
		},
		onError: (e) => {
			toast.error(`入队失败: ${e instanceof Error ? e.message : String(e)}`);
		},
	});

	const retryMutation = useMutation({
		mutationFn: (jobId: string) => retryTask({ data: { jobId } }),
		onSuccess: (_, jobId) => {
			toast.success(`任务 ${jobId.slice(0, 12)}… 已重新入队`);
			queryClient.invalidateQueries({ queryKey: ["admin", "tasks"] });
		},
		onError: (e) => {
			toast.error(`重试失败: ${e instanceof Error ? e.message : String(e)}`);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (jobId: string) => deleteTask({ data: { jobId } }),
		onSuccess: () => {
			toast.success("任务记录已删除");
			queryClient.invalidateQueries({ queryKey: ["admin", "tasks"] });
		},
		onError: (e) => {
			toast.error(`删除失败: ${e instanceof Error ? e.message : String(e)}`);
		},
	});

	const batchDeleteMutation = useMutation({
		mutationFn: (ids: string[]) => batchDeleteTasks({ data: { ids } }),
		onSuccess: (res) => {
			toast.success(`已删除 ${res?.deleted ?? 0} 条任务记录`);
			queryClient.invalidateQueries({ queryKey: ["admin", "tasks"] });
		},
		onError: (e) => {
			toast.error(
				`批量删除失败: ${e instanceof Error ? e.message : String(e)}`,
			);
		},
	});

	const items = list?.items ?? [];
	const total = list?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const hasRunning = items.some(
		(j) => j.status === "running" || j.status === "queued",
	);

	// 当前筛选下可批量删除的终态任务（completed / failed / dead-letter / interrupted）
	const deletableIds = items
		.filter((j) =>
			["completed", "failed", "dead-letter", "interrupted"].includes(j.status),
		)
		.map((j) => j.id);

	const refreshAll = () => {
		queryClient.invalidateQueries({ queryKey: ["admin", "tasks"] });
	};

	return (
		<div className="flex flex-col gap-6">
			<AdminPageHeader
				eyebrow="系统"
				title="任务队列"
				description="监控后台同步任务（VNDB / Kungal / Meilisearch / Cloudreve）的执行状态、进度与日志"
				actions={
					<Button variant="outline" size="sm" onClick={refreshAll}>
						<RefreshCwIcon className="size-4" />
						刷新
					</Button>
				}
			/>

			<StatCards stats={stats} />

			<QueueStatusStrip queues={queueStats} />

			{/* 手动触发 */}
			<Card>
				<CardHeader className="pb-3">
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
				<CardHeader className="pb-0">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<CardTitle className="text-base flex items-center gap-2">
								任务列表
								{hasRunning && (
									<span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
										<Loader2Icon className="size-3 animate-spin" />
										有任务进行中
									</span>
								)}
							</CardTitle>
						</div>
						<div className="flex items-center gap-2">
							<Select
								value={queue}
								onValueChange={(v) => {
									setQueue(v == null || v === "__all__" ? "" : v);
									setPage(0);
								}}
							>
								<SelectTrigger className="w-40 h-8">
									<SelectValue placeholder="全部队列" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__all__">全部队列</SelectItem>
									{Object.entries(queueLabels).map(([key, label]) => (
										<SelectItem key={key} value={key}>
											{label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Button
								variant="outline"
								size="sm"
								disabled={deletableIds.length === 0}
								onClick={() => batchDeleteMutation.mutate(deletableIds)}
							>
								<Trash2Icon className="size-3.5" />
								删除当前筛选记录
							</Button>
						</div>
					</div>
					<Tabs value={status} onValueChange={setStatus} className="mt-3">
						<TabsList>
							{statusTabs.map((tab) => {
								const Icon = tab.icon;
								const count =
									tab.key === "" ? stats?.total : stats?.counts[tab.key];
								return (
									<TabsTrigger
										key={tab.key}
										value={tab.key}
										onClick={() => setPage(0)}
									>
										<Icon className="size-3.5" />
										{tab.label}
										{typeof count === "number" && count > 0 && (
											<span className="text-xs text-muted-foreground tabular-nums">
												{count}
											</span>
										)}
									</TabsTrigger>
								);
							})}
						</TabsList>
					</Tabs>
				</CardHeader>
				<CardContent className="p-0">
					{isLoading ? (
						<div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
							<Loader2Icon className="size-5 animate-spin" />
							加载中...
						</div>
					) : items.length === 0 ? (
						<p className="text-sm text-muted-foreground py-8 text-center">
							暂无任务记录。手动触发一个任务，或等待定时任务执行。
						</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full">
								<thead>
									<tr className="border-b bg-muted/50">
										<th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
											状态
										</th>
										<th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
											任务
										</th>
										<th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
											队列
										</th>
										<th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-48">
											进度
										</th>
										<th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
											创建时间
										</th>
										<th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">
											操作
										</th>
									</tr>
								</thead>
								<tbody>
									{items.map((job) => {
										const retryable = [
											"failed",
											"dead-letter",
											"interrupted",
										].includes(job.status);
										return (
											<tr
												key={job.id}
												className="border-b last:border-0 hover:bg-muted/30 transition-colors"
											>
												<td className="px-4 py-3">
													<StatusPill status={job.status} />
												</td>
												<td className="px-4 py-3 max-w-[260px]">
													<button
														type="button"
														className="text-left"
														onClick={() => setSelectedJob(job)}
													>
														<p className="text-sm font-medium truncate">
															{typeLabels[job.type] ?? job.type}
														</p>
														<p className="text-xs text-muted-foreground font-mono truncate">
															{job.id}
														</p>
													</button>
												</td>
												<td className="px-4 py-3">
													<Badge variant="secondary">
														{queueLabels[job.queue] ?? job.queue}
													</Badge>
												</td>
												<td className="px-4 py-3">
													<div className="flex items-center gap-2">
														<Progress
															value={job.progress}
															className="h-2 flex-1"
														/>
														<span className="text-xs text-muted-foreground tabular-nums w-8 text-right">
															{job.progress}%
														</span>
													</div>
												</td>
												<td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
													{formatTime(job.createdAt)}
												</td>
												<td className="px-4 py-3">
													<div className="flex items-center justify-end gap-1">
														{retryable && (
															<Button
																variant="ghost"
																size="sm"
																title="重试"
																disabled={retryMutation.isPending}
																onClick={() => retryMutation.mutate(job.id)}
															>
																<RotateCcwIcon className="size-4" />
															</Button>
														)}
														<Button
															variant="ghost"
															size="sm"
															title="删除记录"
															disabled={deleteMutation.isPending}
															onClick={() => deleteMutation.mutate(job.id)}
														>
															<Trash2Icon className="size-4 text-destructive" />
														</Button>
													</div>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</CardContent>

				{total > PAGE_SIZE && (
					<div className="flex items-center justify-between px-4 py-3 border-t">
						<span className="text-xs text-muted-foreground">
							共 {total} 条 · 第 {page + 1}/{totalPages} 页
						</span>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setPage(Math.max(0, page - 1))}
								disabled={page <= 0}
							>
								<ChevronLeftIcon className="size-4" />
								上一页
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
								disabled={page >= totalPages - 1}
							>
								下一页
								<ChevronRightIcon className="size-4" />
							</Button>
						</div>
					</div>
				)}
			</Card>

			<TaskDetailDrawer
				job={selectedJob}
				onClose={() => setSelectedJob(null)}
				onMutated={() =>
					queryClient.invalidateQueries({ queryKey: ["admin", "tasks"] })
				}
			/>
		</div>
	);
}
