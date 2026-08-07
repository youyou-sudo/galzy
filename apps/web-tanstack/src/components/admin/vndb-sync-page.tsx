import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@web/components/ui/card";
import { Progress } from "@web/components/ui/progress";
import { cn } from "@web/lib/utils";
import {
	getSyncProgress,
	triggerDeltaSync,
	triggerFullSync,
	triggerProducersSync,
} from "@web/server/admin/vndb-sync";
import {
	AlertCircleIcon,
	CheckCircleIcon,
	DatabaseIcon,
	Loader2Icon,
	PlayIcon,
	RadioIcon,
	RefreshCwIcon,
	XCircleIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";

const statusConfig = {
	idle: { label: "空闲", variant: "secondary" as const, icon: null },
	running: { label: "运行中", variant: "default" as const, icon: Loader2Icon },
	completed: {
		label: "已完成",
		variant: "default" as const,
		icon: CheckCircleIcon,
	},
	failed: { label: "失败", variant: "destructive" as const, icon: XCircleIcon },
};

const stageLabels: Record<string, string> = {
	vn: "同步 VN 数据",
	tags: "同步标签",
	releases: "同步发行版",
	producers: "同步开发者",
	cache: "清理缓存",
};

const logLevelConfig: Record<
	string,
	{ icon: typeof CheckCircleIcon | null; className: string }
> = {
	info: { icon: null, className: "text-muted-foreground" },
	success: { icon: CheckCircleIcon, className: "text-green-600" },
	error: { icon: AlertCircleIcon, className: "text-red-600" },
};

export default function RouteComponent() {
	const queryClient = useQueryClient();
	const logsRef = useRef<HTMLDivElement>(null);
	const forcePollRef = useRef(0);

	const {
		data: progress,
		isLoading,
		dataUpdatedAt,
	} = useQuery({
		queryKey: ["admin", "vndb-sync", "progress"],
		queryFn: () => getSyncProgress(),
		refetchInterval: (query) => {
			if (forcePollRef.current > 0) {
				forcePollRef.current--;
				return 2000;
			}
			const data = query.state.data;
			if (data && data.status === "running") return 2000;
			return false;
		},
	});

	const fullSync = useMutation({
		mutationFn: () => triggerFullSync(),
		onSuccess: () => {
			forcePollRef.current = 10;
			queryClient.invalidateQueries({
				queryKey: ["admin", "vndb-sync", "progress"],
			});
		},
	});

	const deltaSync = useMutation({
		mutationFn: () => triggerDeltaSync(),
		onSuccess: () => {
			forcePollRef.current = 10;
			queryClient.invalidateQueries({
				queryKey: ["admin", "vndb-sync", "progress"],
			});
		},
	});

	const producersSync = useMutation({
		mutationFn: () => triggerProducersSync(),
		onSuccess: () => {
			forcePollRef.current = 10;
			queryClient.invalidateQueries({
				queryKey: ["admin", "vndb-sync", "progress"],
			});
		},
	});

	const isRunning = progress?.status === "running";
	const isPolling = !!(progress && progress.status === "running");
	const status = statusConfig[progress?.status ?? "idle"];

	useEffect(() => {
		if (logsRef.current) {
			logsRef.current.scrollTop = logsRef.current.scrollHeight;
		}
	}, [progress?.logs.length]);

	const progressPercent =
		progress && progress.stageTotal > 0
			? Math.round((progress.stageProcessed / progress.stageTotal) * 100)
			: progress && progress.totalItems > 0
				? Math.round((progress.processedItems / progress.totalItems) * 100)
				: 0;

	return (
		<div className="mx-auto w-full max-w-4xl space-y-6">
			<div>
				<h1 className="text-2xl font-bold tracking-tight">VNDB 数据同步</h1>
				<p className="text-muted-foreground mt-1">
					管理 VNDB 数据全量/增量同步，实时监控同步进度
				</p>
			</div>

			{/* Sync Controls */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<DatabaseIcon className="size-5" />
						同步控制
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex flex-wrap gap-3">
						<Button
							onClick={() => fullSync.mutate()}
							disabled={isRunning}
							variant="default"
						>
							{fullSync.isPending ? (
								<Loader2Icon className="size-4 mr-2 animate-spin" />
							) : (
								<PlayIcon className="size-4 mr-2" />
							)}
							全量同步
						</Button>
						<Button
							onClick={() => deltaSync.mutate()}
							disabled={isRunning}
							variant="outline"
						>
							{deltaSync.isPending ? (
								<Loader2Icon className="size-4 mr-2 animate-spin" />
							) : (
								<PlayIcon className="size-4 mr-2" />
							)}
							增量同步
						</Button>
						<Button
							onClick={() => producersSync.mutate()}
							disabled={isRunning}
							variant="outline"
						>
							{producersSync.isPending ? (
								<Loader2Icon className="size-4 mr-2 animate-spin" />
							) : (
								<PlayIcon className="size-4 mr-2" />
							)}
							开发者同步
						</Button>
						<Button
							onClick={() =>
								queryClient.invalidateQueries({
									queryKey: ["admin", "vndb-sync", "progress"],
								})
							}
							variant="ghost"
							size="icon"
						>
							<RefreshCwIcon
								className={cn("size-4", isPolling && "animate-spin")}
							/>
						</Button>
						{isPolling && (
							<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
								<RadioIcon className="size-3 text-green-500" />
								自动刷新中...
							</span>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Progress Overview */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						同步状态
						{progress && (
							<Badge variant={status.variant}>
								{status.icon && (
									<status.icon
										className={cn("size-3 mr-1", isRunning && "animate-spin")}
									/>
								)}
								{status.label}
							</Badge>
						)}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{isLoading ? (
						<div className="flex items-center gap-2 text-muted-foreground">
							<Loader2Icon className="size-4 animate-spin" />
							加载中...
						</div>
					) : progress && progress.status !== "idle" ? (
						<>
							<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
								<div>
									<span className="text-muted-foreground">类型</span>
									<p className="font-medium">
										{progress.type === "full"
											? "全量"
											: progress.type === "delta"
												? "增量"
												: progress.type === "producers"
													? "开发者"
													: "-"}
									</p>
								</div>
								<div>
									<span className="text-muted-foreground">当前阶段</span>
									<p className="font-medium">
										{progress.stage
											? (stageLabels[progress.stage] ?? progress.stage)
											: "-"}
									</p>
								</div>
								<div>
									<span className="text-muted-foreground">阶段进度</span>
									<p className="font-medium">
										{progress.stageTotal > 0
											? `${progress.stageProcessed}/${progress.stageTotal}`
											: `${progress.processedItems}/${progress.totalItems}`}
									</p>
								</div>
								<div>
									<span className="text-muted-foreground">错误数</span>
									<p className="font-medium">{progress.errors}</p>
								</div>
							</div>

							<Progress value={progressPercent} />

							{progress.startedAt && (
								<p className="text-xs text-muted-foreground">
									开始时间: {new Date(progress.startedAt).toLocaleString()}
									{progress.completedAt &&
										` · 完成时间: ${new Date(progress.completedAt).toLocaleString()}`}
									{dataUpdatedAt > 0 &&
										` · 数据更新: ${new Date(dataUpdatedAt).toLocaleTimeString()}`}
								</p>
							)}
						</>
					) : (
						<p className="text-muted-foreground text-sm">
							暂无同步记录，点击上方按钮开始同步
						</p>
					)}
				</CardContent>
			</Card>

			{/* Log Output */}
			<Card>
				<CardHeader>
					<CardTitle>同步日志</CardTitle>
				</CardHeader>
				<CardContent>
					<div
						ref={logsRef}
						className="bg-muted rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-xs space-y-1"
					>
						{progress?.logs && progress.logs.length > 0 ? (
							progress.logs.map((log, i) => {
								const cfg = logLevelConfig[log.level];
								const Icon = cfg.icon;
								return (
									<div key={i} className={cfg.className}>
										<span className="text-muted-foreground/60">
											{new Date(log.time).toLocaleTimeString()}
										</span>{" "}
										{Icon && <Icon className="size-3 inline mr-1" />}
										{log.message}
									</div>
								);
							})
						) : (
							<span className="text-muted-foreground">等待同步开始...</span>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
