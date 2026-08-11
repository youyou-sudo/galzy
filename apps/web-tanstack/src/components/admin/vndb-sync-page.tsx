import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminPageHeader } from "@web/components/admin/admin-page-header";
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
	checkCloudreveFiles,
	getCloudreveSyncStatus,
	getSyncProgress,
	triggerCloudreveSync,
	triggerDeltaSync,
	triggerFullSync,
	triggerProducersSync,
} from "@web/server/admin/vndb-sync";
import {
	AlertCircleIcon,
	CheckCircleIcon,
	DatabaseIcon,
	FolderSearchIcon,
	FolderSyncIcon,
	Loader2Icon,
	PlayIcon,
	RadioIcon,
	RefreshCwIcon,
	XCircleIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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

	// ── Cloudreve 文件同步 ──────────────────────────────
	const [cloudreveReport, setCloudreveReport] =
		useState<CloudreveCheckResult | null>(null);

	const { data: cloudreveStatus } = useQuery({
		queryKey: ["admin", "vndb-sync", "cloudreve-status"],
		queryFn: () => getCloudreveSyncStatus(),
	});

	// 触发接口同步完成后返回结果：成功则刷新状态并自动重新巡检展示修复结果，
	// 失败（锁被占用/同步报错）则 toast 提示
	const cloudreveSync = useMutation({
		mutationFn: () => triggerCloudreveSync(),
		onSuccess: (data) => {
			if (!data?.ok) {
				toast.error(
					data && "message" in data ? data.message : "Cloudreve 同步失败",
				);
				return;
			}
			setCloudreveReport(null);
			queryClient.invalidateQueries({
				queryKey: ["admin", "vndb-sync", "cloudreve-status"],
			});
			void checkCloudreveFiles()
				.then((d) => setCloudreveReport(d ?? null))
				.catch(() => {});
		},
	});

	const cloudreveCheck = useMutation({
		mutationFn: () => checkCloudreveFiles(),
		onSuccess: (data) => setCloudreveReport(data ?? null),
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
		<div className="flex flex-col gap-6">
			<AdminPageHeader
				eyebrow="系统"
				title="VNDB 数据同步"
				description="管理 VNDB 数据全量/增量同步，实时监控同步进度"
			/>

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

			{/* Cloudreve 文件同步 */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<FolderSyncIcon className="size-5" />
						Cloudreve 文件同步
					</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					{cloudreveStatus ? (
						<div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 text-sm">
							<div>
								<span className="text-muted-foreground">上次同步</span>
								<p className="font-medium">
									{new Date(cloudreveStatus.lastUpdate).toLocaleString()}
								</p>
							</div>
							<div>
								<span className="text-muted-foreground">发现文件夹</span>
								<p className="font-medium">{cloudreveStatus.foldersFound}</p>
							</div>
							<div>
								<span className="text-muted-foreground">新增</span>
								<p className="font-medium">{cloudreveStatus.added}</p>
							</div>
							<div>
								<span className="text-muted-foreground">更新</span>
								<p className="font-medium">{cloudreveStatus.updated}</p>
							</div>
							<div>
								<span className="text-muted-foreground">保留</span>
								<p className="font-medium">{cloudreveStatus.kept}</p>
							</div>
							<div>
								<span className="text-muted-foreground">删除</span>
								<p className="font-medium">{cloudreveStatus.deleted}</p>
							</div>
							<div>
								<span className="text-muted-foreground">耗时</span>
								<p className="font-medium">
									{(cloudreveStatus.tookMs / 1000).toFixed(1)}s
								</p>
							</div>
						</div>
					) : (
						<p className="text-muted-foreground text-sm">
							尚未执行过 Cloudreve 文件同步，点击下方按钮开始
						</p>
					)}

					<div className="flex flex-wrap gap-3">
						<Button
							onClick={() => cloudreveSync.mutate()}
							disabled={cloudreveSync.isPending}
							variant="default"
						>
							{cloudreveSync.isPending ? (
								<Loader2Icon className="size-4 mr-2 animate-spin" />
							) : (
								<PlayIcon className="size-4 mr-2" />
							)}
							{cloudreveSync.isPending ? "同步中..." : "立即同步"}
						</Button>
						<Button
							onClick={() => cloudreveCheck.mutate()}
							disabled={cloudreveCheck.isPending || cloudreveSync.isPending}
							variant="outline"
						>
							{cloudreveCheck.isPending ? (
								<Loader2Icon className="size-4 mr-2 animate-spin" />
							) : (
								<FolderSearchIcon className="size-4 mr-2" />
							)}
							检测文件缺失
						</Button>
					</div>

					{cloudreveReport && <CloudreveReport report={cloudreveReport} />}
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

// ── Cloudreve 文件缺失巡检结果 ────────────────────────

// 直接复用 server function 的返回类型（Eden 推断），避免本地重复声明导致形状漂移；
// treaty data 可能为 undefined，这里归一为可空联合
type CloudreveCheckResult = NonNullable<
	Awaited<ReturnType<typeof checkCloudreveFiles>>
>;

function CloudreveReport({ report }: { report: CloudreveCheckResult }) {
	const hasIssue =
		report.added > 0 ||
		report.updated > 0 ||
		report.deleted > 0 ||
		report.vnWithoutAlistb.samples.length > 0;

	return (
		<div className="flex flex-col gap-3 border-t pt-4">
			<div className="flex flex-wrap gap-2">
				<Badge variant="secondary">发现文件夹 {report.foldersFound}</Badge>
				<Badge variant="secondary">待新增 {report.added}</Badge>
				<Badge variant={report.updated > 0 ? "destructive" : "secondary"}>
					路径待更新 {report.updated}
				</Badge>
				<Badge variant="secondary">待删除 {report.deleted}</Badge>
				<Badge variant="secondary">保留 {report.kept}</Badge>
				<Badge
					variant={
						report.vnWithoutAlistb.samples.length > 0
							? "destructive"
							: "secondary"
					}
				>
					无文件条目 {report.vnWithoutAlistb.total}
				</Badge>
			</div>

			{!hasIssue && (
				<p className="text-sm text-green-600">
					未发现异常，Cloudreve 目录与文件条目一致
				</p>
			)}

			{report.updatedRows.length > 0 && (
				<div className="flex flex-col gap-1">
					<p className="text-sm font-medium">
						路径已变更（文件夹被移动/改名，同步后自动修复）
					</p>
					<div className="max-h-48 overflow-y-auto rounded-lg bg-muted p-3 font-mono text-xs flex flex-col gap-2">
						{report.updatedRows.map((r) => (
							<div key={r.vid} className="flex flex-col">
								<span className="text-primary">{r.vid}</span>
								<span className="text-muted-foreground line-through">
									{r.oldPaths.join(" / ") || "（无路径）"}
								</span>
								<span className="text-green-600">{r.newPaths.join(" / ")}</span>
							</div>
						))}
					</div>
				</div>
			)}

			{report.addedRows.length > 0 && (
				<div className="flex flex-col gap-1">
					<p className="text-sm font-medium">Cloudreve 新增文件夹</p>
					<div className="max-h-40 overflow-y-auto rounded-lg bg-muted p-3 font-mono text-xs flex flex-col gap-1">
						{report.addedRows.map((r) => (
							<div key={r.vid}>
								<span className="text-primary">{r.vid}</span>{" "}
								{r.paths.join(" / ")}
							</div>
						))}
					</div>
				</div>
			)}

			{report.staleDeadRows.length > 0 && (
				<div className="flex flex-col gap-1">
					<p className="text-sm font-medium">
						文件夹已从 Cloudreve 删除（同步时移除文件条目）
					</p>
					<div className="max-h-40 overflow-y-auto rounded-lg bg-muted p-3 font-mono text-xs flex flex-col gap-1">
						{report.staleDeadRows.map((r) => (
							<div key={r.vid}>
								<span className="text-primary">{r.vid}</span>{" "}
								{r.paths.join(" / ")}
							</div>
						))}
					</div>
				</div>
			)}

			{report.staleAliveRows.length > 0 && (
				<p className="text-xs text-muted-foreground">
					搜索结果缺失但路径仍存在 {report.staleAliveRows.length}{" "}
					个（保留不动）：
					{report.staleAliveRows.map((r) => r.vid).join(", ")}
				</p>
			)}

			{report.vnWithoutAlistb.samples.length > 0 && (
				<div className="flex flex-col gap-1">
					<p className="text-sm font-medium">
						有 VNDB 数据但无文件条目（文件夹已删除或改名，共{" "}
						{report.vnWithoutAlistb.total}
						{report.vnWithoutAlistb.truncated ? "+" : ""} 个）
					</p>
					<div className="max-h-32 overflow-y-auto rounded-lg bg-muted p-3 font-mono text-xs flex flex-wrap gap-x-2 gap-y-1">
						{report.vnWithoutAlistb.samples.map((vid) => (
							<span key={vid} className="text-muted-foreground">
								{vid}
							</span>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
