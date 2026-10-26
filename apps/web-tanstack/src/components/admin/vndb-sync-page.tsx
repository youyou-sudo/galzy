import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusPill, type StatusTone } from "@web/components/admin/admin-table";
import { AdminPageHeader } from "@web/components/admin/admin-page-header";
import { EmptyState } from "@web/components/shared/empty-state";
import { IconTile } from "@web/components/shared/icon-tile";
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

const statusConfig: Record<
	"idle" | "running" | "completed" | "failed",
	{
		label: string;
		tone: StatusTone;
		icon?: typeof CheckCircleIcon;
		spin?: boolean;
	}
> = {
	idle: { label: "空闲", tone: "neutral" },
	running: { label: "运行中", tone: "info", icon: Loader2Icon, spin: true },
	completed: { label: "已完成", tone: "success", icon: CheckCircleIcon },
	failed: { label: "失败", tone: "destructive", icon: XCircleIcon },
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
	success: { icon: CheckCircleIcon, className: "text-success" },
	error: { icon: AlertCircleIcon, className: "text-destructive" },
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
				icon={DatabaseIcon}
				eyebrow="系统"
				title="VNDB 数据同步"
				description="管理 VNDB 数据全量/增量同步，实时监控同步进度"
			/>

			{/* Sync Controls */}
			<Card>
				<CardHeader>
					<CardTitle className="flex gap-2.5 items-center text-base">
						<IconTile icon={DatabaseIcon} size="sm" tone="muted" />
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
								<Loader2Icon className="size-4 animate-spin" />
							) : (
								<PlayIcon className="size-4" />
							)}
							全量同步
						</Button>
						<Button
							onClick={() => deltaSync.mutate()}
							disabled={isRunning}
							variant="outline"
						>
							{deltaSync.isPending ? (
								<Loader2Icon className="size-4 animate-spin" />
							) : (
								<PlayIcon className="size-4" />
							)}
							增量同步
						</Button>
						<Button
							onClick={() => producersSync.mutate()}
							disabled={isRunning}
							variant="outline"
						>
							{producersSync.isPending ? (
								<Loader2Icon className="size-4 animate-spin" />
							) : (
								<PlayIcon className="size-4" />
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
							<span className="inline-flex gap-1 items-center text-xs text-muted-foreground">
								<RadioIcon className="size-3 text-success" />
								自动刷新中...
							</span>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Cloudreve 文件同步 */}
			<Card>
				<CardHeader>
					<CardTitle className="flex gap-2.5 items-center text-base">
						<IconTile icon={FolderSyncIcon} size="sm" tone="muted" />
						Cloudreve 文件同步
					</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					{cloudreveStatus ? (
						<div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4 lg:grid-cols-7">
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
						<EmptyState
							icon={FolderSyncIcon}
							title="尚未执行过 Cloudreve 文件同步"
							description="点击下方「立即同步」开始拉取文件目录"
							size="sm"
						/>
					)}

					<div className="flex flex-wrap gap-3">
						<Button
							onClick={() => cloudreveSync.mutate()}
							disabled={cloudreveSync.isPending}
							variant="default"
						>
							{cloudreveSync.isPending ? (
								<Loader2Icon className="size-4 animate-spin" />
							) : (
								<PlayIcon className="size-4" />
							)}
							{cloudreveSync.isPending ? "同步中..." : "立即同步"}
						</Button>
						<Button
							onClick={() => cloudreveCheck.mutate()}
							disabled={cloudreveCheck.isPending || cloudreveSync.isPending}
							variant="outline"
						>
							{cloudreveCheck.isPending ? (
								<Loader2Icon className="size-4 animate-spin" />
							) : (
								<FolderSearchIcon className="size-4" />
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
					<CardTitle className="flex gap-2.5 items-center text-base">
						<IconTile icon={RadioIcon} size="sm" tone="muted" />
						同步状态
						{progress && (
							<StatusPill
								tone={status.tone}
								icon={status.icon}
								spin={isRunning}
							>
								{status.label}
							</StatusPill>
						)}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{isLoading ? (
						<div className="flex gap-2 items-center text-muted-foreground">
							<Loader2Icon className="size-4 animate-spin" />
							加载中...
						</div>
					) : progress && progress.status !== "idle" ? (
						<>
							<div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
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
						<EmptyState
							icon={DatabaseIcon}
							title="暂无同步记录"
							description="点击上方按钮开始一次全量或增量同步"
							size="sm"
						/>
					)}
				</CardContent>
			</Card>

			{/* Log Output */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">同步日志</CardTitle>
				</CardHeader>
				<CardContent>
					<div
						ref={logsRef}
						className="overflow-y-auto p-4 space-y-1 max-h-96 font-mono text-xs bg-muted/60 rounded-xl"
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
										{Icon && <Icon className="inline mr-1 size-3" />}
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
		<div className="flex flex-col gap-3 pt-4 border-t">
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
				<p className="text-sm font-medium text-success">
					未发现异常，Cloudreve 目录与文件条目一致
				</p>
			)}

			{report.updatedRows.length > 0 && (
				<div className="flex flex-col gap-1">
					<p className="text-sm font-medium">
						路径已变更（文件夹被移动/改名，同步后自动修复）
					</p>
					<div className="flex overflow-y-auto flex-col gap-2 p-3 max-h-48 font-mono text-xs bg-muted rounded-lg">
						{report.updatedRows.map((r) => (
							<div key={r.displayId} className="flex flex-col">
								<span className="text-primary">{r.displayId}</span>
								<span className="text-muted-foreground line-through">
									{r.oldPaths.join(" / ") || "（无路径）"}
								</span>
								<span className="text-success">{r.newPaths.join(" / ")}</span>
							</div>
						))}
					</div>
				</div>
			)}

			{report.renamedRows.length > 0 && (
				<div className="flex flex-col gap-1">
					<p className="text-sm font-medium">
						条目身份已收口（kungal 锚点补到 vndb /
						文件夹改名，同步后合并为一条）
					</p>
					<div className="flex overflow-y-auto flex-col gap-2 p-3 max-h-48 font-mono text-xs bg-muted rounded-lg">
						{report.renamedRows.map((r) => (
							<div key={`${r.fromId}->${r.toId}`} className="flex flex-col">
								<span className="text-primary">
									<span className="line-through">{r.fromId}</span>
									{" → "}
									{r.toId}
								</span>
								<span className="text-success">{r.paths.join(" / ")}</span>
							</div>
						))}
					</div>
				</div>
			)}

			{report.addedRows.length > 0 && (
				<div className="flex flex-col gap-1">
					<p className="text-sm font-medium">Cloudreve 新增文件夹</p>
					<div className="flex overflow-y-auto flex-col gap-1 p-3 max-h-40 font-mono text-xs bg-muted rounded-lg">
						{report.addedRows.map((r) => (
							<div key={r.displayId}>
								<span className="text-primary">{r.displayId}</span>{" "}
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
					<div className="flex overflow-y-auto flex-col gap-1 p-3 max-h-40 font-mono text-xs bg-muted rounded-lg">
						{report.staleDeadRows.map((r) => (
							<div key={r.displayId}>
								<span className="text-primary">{r.displayId}</span>{" "}
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
					{report.staleAliveRows.map((r) => r.displayId).join(", ")}
				</p>
			)}

			{report.vnWithoutAlistb.samples.length > 0 && (
				<div className="flex flex-col gap-1">
					<p className="text-sm font-medium">
						有 VNDB 数据但无文件条目（文件夹已删除或改名，共{" "}
						{report.vnWithoutAlistb.total}
						{report.vnWithoutAlistb.truncated ? "+" : ""} 个）
					</p>
					<div className="flex overflow-y-auto flex-wrap gap-x-2 gap-y-1 p-3 max-h-32 font-mono text-xs bg-muted rounded-lg">
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
