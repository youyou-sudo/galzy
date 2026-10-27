import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminPageHeader } from "@web/components/admin/admin-page-header";
import { StatusPill, type StatusTone } from "@web/components/admin/admin-table";
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
import { useAdminMutation } from "@web/hooks/use-admin-mutation";
import { adminKeys } from "@web/lib/admin/query-keys";
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
import type { LucideIcon } from "lucide-react";
import {
	AlertCircleIcon,
	CheckCircleIcon,
	Clock3Icon,
	DatabaseIcon,
	FolderSearchIcon,
	FolderSyncIcon,
	Loader2Icon,
	PlayIcon,
	RadioIcon,
	RefreshCwIcon,
	TimerIcon,
	TriangleAlertIcon,
	XCircleIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ─── 类型 ─────────────────────────────────────────────────────

type SyncType = "full" | "delta" | "producers";

/** 服务端同步进度（Eden 推断，避免本地重复声明漂移） */
type SyncProgressData = NonNullable<
	Awaited<ReturnType<typeof getSyncProgress>>
>;

/** Cloudreve 同步统计；syncing 是本地乐观标记，仅用于「同步中」状态展示 */
type CloudreveStatusData = NonNullable<
	Awaited<ReturnType<typeof getCloudreveSyncStatus>>
> & { syncing?: boolean };

/** 文件巡检结果 */
type CloudreveCheckResult = NonNullable<
	Awaited<ReturnType<typeof checkCloudreveFiles>>
>;

type SyncDisplayStatus = "idle" | "queued" | "running" | "completed" | "failed";

// ─── 文案 / 样式映射 ──────────────────────────────────────────

const statusConfig: Record<
	SyncDisplayStatus,
	{
		label: string;
		tone: StatusTone;
		icon?: LucideIcon;
		spin?: boolean;
	}
> = {
	idle: { label: "空闲", tone: "neutral", icon: Clock3Icon },
	queued: { label: "已入队", tone: "info", icon: Clock3Icon },
	running: { label: "运行中", tone: "info", icon: Loader2Icon, spin: true },
	completed: { label: "已完成", tone: "success", icon: CheckCircleIcon },
	failed: { label: "失败", tone: "destructive", icon: XCircleIcon },
};

const typeLabels: Record<SyncType, string> = {
	full: "全量同步",
	delta: "增量同步",
	producers: "开发者同步",
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
	{ icon: LucideIcon | null; className: string }
> = {
	info: { icon: null, className: "text-muted-foreground" },
	success: { icon: CheckCircleIcon, className: "text-success" },
	error: { icon: AlertCircleIcon, className: "text-destructive" },
};

/** 轮询节奏：运行中 2s，空闲 15s（不空转请求）。 */
const RUNNING_POLL_MS = 2000;
const IDLE_POLL_MS = 15000;
/** 触发同步后的加速轮询窗口：覆盖「入队 → worker 拉起」的空档 */
const BOOST_POLL_WINDOW_MS = 60_000;

function describeError(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return "未知错误";
}

/** 触发同步后的乐观进度：立刻把进度卡切到「运行中」，不等下一次轮询。 */
function optimisticProgress(
	previous: SyncProgressData | undefined,
	type: SyncType,
	label: string,
): SyncProgressData {
	const now = new Date().toISOString();
	const logs = [
		...(previous?.logs ?? []).slice(-199),
		{ time: now, level: "info" as const, message: `${label}已入队，等待执行…` },
	];
	return {
		status: "running",
		type,
		startedAt: now,
		completedAt: null,
		stage: null,
		totalItems: 0,
		processedItems: 0,
		totalBatches: 0,
		processedBatches: 0,
		stageTotal: 0,
		stageProcessed: 0,
		errors: 0,
		logs,
		lastUpdated: now,
	};
}

// ─── 通用卡片原语 ────────────────────────────────────────────

/** 统一 KPI 卡：图标底片 + 数值 + 说明，数字统一 tabular-nums。 */
function KpiCard({
	icon,
	label,
	value,
	hint,
	tone = "muted",
}: {
	icon: LucideIcon;
	label: string;
	value: ReactNode;
	hint?: ReactNode;
	tone?: "muted" | "primary" | "success" | "warning" | "info" | "destructive";
}) {
	return (
		<div className="flex gap-3 items-start p-4 bg-card rounded-2xl ring-1 ring-border/60">
			<IconTile icon={icon} size="md" tone={tone} />
			<div className="flex flex-col gap-0.5 min-w-0">
				<p className="text-xs text-muted-foreground">{label}</p>
				<div className="text-lg font-semibold tabular-nums truncate">
					{value}
				</div>
				{hint && (
					<p className="text-xs text-muted-foreground/70 truncate">{hint}</p>
				)}
			</div>
		</div>
	);
}

/** 紧凑统计项（Cloudreve 数字区）。 */
function MiniStat({ label, value }: { label: string; value: ReactNode }) {
	return (
		<div className="flex flex-col gap-0.5 min-w-0">
			<span className="text-xs text-muted-foreground">{label}</span>
			<span className="text-sm font-medium tabular-nums truncate">{value}</span>
		</div>
	);
}

// ─── 同步触发（乐观更新） ────────────────────────────────────

function useSyncTrigger(
	type: SyncType,
	handlers: {
		onQueued: (type: SyncType) => void;
		boostPolling: () => void;
	},
) {
	const label = typeLabels[type];
	const trigger =
		type === "full"
			? triggerFullSync
			: type === "delta"
				? triggerDeltaSync
				: triggerProducersSync;

	return useAdminMutation<{ ok?: boolean; message?: string } | null, void>({
		mutationFn: async () => {
			const data = await trigger();
			if (data && data.ok === false) {
				throw new Error(data.message || `${label}触发失败`);
			}
			return data;
		},
		optimistic: (queryClient) => {
			queryClient.setQueryData<SyncProgressData>(
				adminKeys.vndbSyncProgress(),
				(previous) => optimisticProgress(previous, type, label),
			);
		},
		affects: [adminKeys.vndbSyncProgress()],
		successMessage: (data) => data?.message ?? `${label}已触发`,
		errorMessage: (error) => `${label}触发失败：${describeError(error)}`,
		onSuccess: () => {
			handlers.onQueued(type);
			handlers.boostPolling();
		},
	});
}

// ─── 页面 ────────────────────────────────────────────────────

export default function RouteComponent() {
	const queryClient = useQueryClient();
	const logsRef = useRef<HTMLDivElement>(null);
	const boostPollUntilRef = useRef(0);
	const [queued, setQueued] = useState<{ type: SyncType } | null>(null);
	const [cloudreveReport, setCloudreveReport] =
		useState<CloudreveCheckResult | null>(null);

	// ── 同步进度（运行中 2s / 空闲 15s） ──────────────────────
	const {
		data: progress,
		isLoading,
		isFetching,
		dataUpdatedAt,
	} = useQuery({
		queryKey: adminKeys.vndbSyncProgress(),
		queryFn: () => getSyncProgress(),
		refetchInterval: (query) => {
			if (boostPollUntilRef.current > Date.now()) return RUNNING_POLL_MS;
			const data = query.state.data;
			if (data && data.status === "running") return RUNNING_POLL_MS;
			return IDLE_POLL_MS;
		},
	});

	const boostPolling = () => {
		boostPollUntilRef.current = Date.now() + BOOST_POLL_WINDOW_MS;
	};
	const handleQueued = (type: SyncType) => setQueued({ type });

	const fullSync = useSyncTrigger("full", {
		onQueued: handleQueued,
		boostPolling,
	});
	const deltaSync = useSyncTrigger("delta", {
		onQueued: handleQueued,
		boostPolling,
	});
	const producersSync = useSyncTrigger("producers", {
		onQueued: handleQueued,
		boostPolling,
	});

	// 服务端真正进入 running 后清掉「已入队」标记；超时兜底避免一直挂着
	useEffect(() => {
		if (!queued) return;
		const running = progress?.status === "running";
		if (running) {
			setQueued(null);
			return;
		}
		const timer = setTimeout(() => setQueued(null), BOOST_POLL_WINDOW_MS);
		return () => clearTimeout(timer);
	}, [queued, progress?.status]);

	// 任务结束后退出加速轮询
	useEffect(() => {
		if (progress?.status === "completed" || progress?.status === "failed") {
			boostPollUntilRef.current = 0;
		}
	}, [progress?.status]);

	// ── Cloudreve 文件同步 ──────────────────────────────────────
	const { data: cloudreveStatus } = useQuery<CloudreveStatusData | null>({
		queryKey: adminKeys.vndbSyncCloudreve(),
		queryFn: () => getCloudreveSyncStatus(),
	});

	const cloudreveCheck = useAdminMutation<
		CloudreveCheckResult | null | undefined,
		void
	>({
		mutationFn: () => checkCloudreveFiles(),
		affects: [],
		successMessage: "",
		errorMessage: (error) => `文件巡检失败：${describeError(error)}`,
		onSuccess: (data) => setCloudreveReport(data ?? null),
	});

	const cloudreveSync = useAdminMutation<
		{ ok?: boolean; message?: string } | null,
		void
	>({
		mutationFn: async () => {
			const data = await triggerCloudreveSync();
			if (data && data.ok === false) {
				throw new Error(
					"message" in data && data.message
						? data.message
						: "Cloudreve 同步失败",
				);
			}
			return data;
		},
		// 乐观：立刻把状态卡切成「同步中」，避免等待整次同步返回
		optimistic: (client) => {
			client.setQueryData<CloudreveStatusData | null>(
				adminKeys.vndbSyncCloudreve(),
				(previous) => (previous ? { ...previous, syncing: true } : previous),
			);
		},
		affects: [adminKeys.vndbSyncCloudreve()],
		successMessage: (data) =>
			data && "message" in data && data.message
				? data.message
				: "Cloudreve 同步完成",
		errorMessage: (error) => describeError(error),
		onSuccess: () => {
			setCloudreveReport(null);
			// 同步完成后自动巡检一次，展示修复结果
			cloudreveCheck.mutate();
		},
	});

	// ── 派生状态 ───────────────────────────────────────────────
	const progressStatus = progress?.status ?? "idle";
	const isRunning = progressStatus === "running";
	const displayStatus: SyncDisplayStatus = isRunning
		? "running"
		: queued
			? "queued"
			: progressStatus;
	const status = statusConfig[displayStatus];
	const displayType = isRunning
		? progress?.type
		: (queued?.type ?? progress?.type);
	const busy = displayStatus === "running" || displayStatus === "queued";

	const progressPercent =
		progress && progress.stageTotal > 0
			? Math.round((progress.stageProcessed / progress.stageTotal) * 100)
			: progress && progress.totalItems > 0
				? Math.round((progress.processedItems / progress.totalItems) * 100)
				: 0;

	const hasRecord = progress != null && progress.status !== "idle";

	useEffect(() => {
		if (logsRef.current) {
			logsRef.current.scrollTop = logsRef.current.scrollHeight;
		}
	}, [progress?.logs.length]);

	const refreshProgress = () => {
		boostPolling();
		void queryClient.invalidateQueries({
			queryKey: adminKeys.vndbSyncProgress(),
		});
		toast.info("正在刷新同步进度");
	};

	return (
		<div className="flex flex-col gap-6">
			<AdminPageHeader
				icon={DatabaseIcon}
				eyebrow="系统"
				title="VNDB 数据同步"
				description="管理 VNDB 数据全量 / 增量同步，实时监控同步进度"
				actions={
					<div className="flex flex-wrap gap-2">
						<Button
							size="sm"
							onClick={() => fullSync.mutate()}
							disabled={busy || fullSync.isPending}
						>
							{fullSync.isPending ? (
								<Loader2Icon className="size-4 animate-spin" />
							) : (
								<PlayIcon className="size-4" />
							)}
							全量同步
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={() => deltaSync.mutate()}
							disabled={busy || deltaSync.isPending}
						>
							{deltaSync.isPending ? (
								<Loader2Icon className="size-4 animate-spin" />
							) : (
								<PlayIcon className="size-4" />
							)}
							增量同步
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={() => producersSync.mutate()}
							disabled={busy || producersSync.isPending}
						>
							{producersSync.isPending ? (
								<Loader2Icon className="size-4 animate-spin" />
							) : (
								<PlayIcon className="size-4" />
							)}
							开发者同步
						</Button>
					</div>
				}
			/>

			{/* ── KPI 概览 ─────────────────────────────────────── */}
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<KpiCard
					icon={RadioIcon}
					label="同步状态"
					value={
						<StatusPill
							tone={status.tone}
							icon={status.icon}
							spin={status.spin}
						>
							{status.label}
						</StatusPill>
					}
					hint={isRunning ? "自动刷新中…" : "每 15 秒自动检查"}
					tone={status.tone === "neutral" ? "muted" : status.tone}
				/>
				<KpiCard
					icon={DatabaseIcon}
					label="同步类型"
					value={displayType ? typeLabels[displayType] : "-"}
					hint={
						progress?.totalBatches
							? `共 ${progress.totalBatches} 批`
							: "尚未开始"
					}
				/>
				<KpiCard
					icon={TimerIcon}
					label="当前阶段"
					value={
						progress?.stage
							? (stageLabels[progress.stage] ?? progress.stage)
							: "-"
					}
					hint={
						progress?.stageTotal
							? `${progress.stageProcessed}/${progress.stageTotal}`
							: "等待任务开始"
					}
				/>
				<KpiCard
					icon={
						progress && progress.errors > 0
							? TriangleAlertIcon
							: CheckCircleIcon
					}
					label="错误数"
					value={progress?.errors ?? 0}
					tone={progress && progress.errors > 0 ? "destructive" : "success"}
					hint={progress?.errors ? "请查看同步日志" : "无错误"}
				/>
			</div>

			{/* ── 同步进度 ─────────────────────────────────────── */}
			<Card>
				<CardHeader>
					<div className="flex flex-wrap gap-2 justify-between items-center">
						<CardTitle className="flex gap-2.5 items-center text-base">
							<IconTile icon={RadioIcon} size="sm" tone="muted" />
							同步进度
							{progress && (
								<StatusPill
									tone={status.tone}
									icon={status.icon}
									spin={status.spin}
								>
									{status.label}
								</StatusPill>
							)}
						</CardTitle>
						<div className="flex gap-2 items-center">
							{isRunning && (
								<span className="inline-flex gap-1 items-center text-xs text-muted-foreground">
									<RadioIcon className="size-3 text-success" />
									自动刷新中…
								</span>
							)}
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={refreshProgress}
								aria-label="刷新同步进度"
							>
								<RefreshCwIcon
									className={cn("size-4", isFetching && "animate-spin")}
								/>
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent
					className={cn(
						"flex flex-col gap-4 transition-opacity duration-200",
						isFetching && !isLoading && "opacity-60",
					)}
				>
					{isLoading ? (
						<div className="flex flex-col gap-3">
							<div className="h-2 bg-muted rounded-full animate-pulse" />
							<div className="w-1/2 h-3 bg-muted rounded animate-pulse" />
						</div>
					) : !hasRecord && !queued ? (
						<EmptyState
							icon={DatabaseIcon}
							title="暂无同步记录"
							description="触发一次全量或增量同步后，这里会实时展示阶段进度与日志"
							size="sm"
							action={
								<Button
									size="sm"
									variant="outline"
									onClick={() => deltaSync.mutate()}
								>
									<PlayIcon className="size-4" />
									开始增量同步
								</Button>
							}
						/>
					) : (
						<>
							<div className="flex flex-col gap-1.5">
								<div className="flex justify-between items-center text-xs text-muted-foreground">
									<span className="tabular-nums">
										{displayStatus === "queued"
											? "已入队，等待执行"
											: progress && progress.stageTotal > 0
												? `${progress.stageProcessed} / ${progress.stageTotal}`
												: progress
													? `${progress.processedItems} / ${progress.totalItems}`
													: "等待任务开始"}
									</span>
									<span className="tabular-nums">{progressPercent}%</span>
								</div>
								<Progress value={progressPercent} />
							</div>

							<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
								{progress?.startedAt && (
									<span>
										开始时间: {new Date(progress.startedAt).toLocaleString()}
									</span>
								)}
								{progress?.completedAt && (
									<span>
										完成时间: {new Date(progress.completedAt).toLocaleString()}
									</span>
								)}
								{dataUpdatedAt > 0 && (
									<span>
										数据更新: {new Date(dataUpdatedAt).toLocaleTimeString()}
									</span>
								)}
							</div>

							<div className="flex flex-col gap-2">
								<div className="flex gap-2.5 items-center">
									<IconTile icon={AlertCircleIcon} size="sm" tone="muted" />
									<span className="text-sm font-medium">同步日志</span>
								</div>
								<div
									ref={logsRef}
									className="overflow-y-auto p-3 space-y-1 max-h-72 font-mono text-xs bg-muted/40 rounded-xl ring-1 ring-border/60"
								>
									{progress?.logs && progress.logs.length > 0 ? (
										progress.logs.map((log, index) => {
											const config =
												logLevelConfig[log.level] ?? logLevelConfig.info;
											const LogIcon = config.icon;
											return (
												<div
													key={`${log.time}-${index}`}
													className={cn(
														"flex gap-1.5 items-start",
														config.className,
													)}
												>
													<span className="shrink-0 text-muted-foreground/60">
														{new Date(log.time).toLocaleTimeString()}
													</span>
													{LogIcon && (
														<LogIcon className="shrink-0 mt-0.5 size-3" />
													)}
													<span className="break-all">{log.message}</span>
												</div>
											);
										})
									) : (
										<span className="text-muted-foreground">等待同步开始…</span>
									)}
								</div>
							</div>
						</>
					)}
				</CardContent>
			</Card>

			{/* ── Cloudreve 文件同步 ───────────────────────────── */}
			<Card>
				<CardHeader>
					<div className="flex flex-wrap gap-2 justify-between items-center">
						<CardTitle className="flex gap-2.5 items-center text-base">
							<IconTile icon={FolderSyncIcon} size="sm" tone="muted" />
							Cloudreve 文件同步
						</CardTitle>
						<div className="flex flex-wrap gap-2 items-center">
							{(cloudreveStatus?.syncing || cloudreveSync.isPending) && (
								<StatusPill tone="info" icon={Loader2Icon} spin>
									同步中
								</StatusPill>
							)}
							{cloudreveCheck.isPending && (
								<StatusPill tone="info" icon={Loader2Icon} spin>
									检测中
								</StatusPill>
							)}
							<Button
								size="sm"
								onClick={() => cloudreveSync.mutate()}
								disabled={cloudreveSync.isPending || cloudreveCheck.isPending}
							>
								{cloudreveSync.isPending ? (
									<Loader2Icon className="size-4 animate-spin" />
								) : (
									<PlayIcon className="size-4" />
								)}
								{cloudreveSync.isPending ? "同步中…" : "立即同步"}
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={() => cloudreveCheck.mutate()}
								disabled={cloudreveCheck.isPending || cloudreveSync.isPending}
							>
								{cloudreveCheck.isPending ? (
									<Loader2Icon className="size-4 animate-spin" />
								) : (
									<FolderSearchIcon className="size-4" />
								)}
								检测文件缺失
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					{cloudreveStatus ? (
						<div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 lg:grid-cols-7">
							<MiniStat
								label="上次同步"
								value={new Date(cloudreveStatus.lastUpdate).toLocaleString()}
							/>
							<MiniStat
								label="发现文件夹"
								value={cloudreveStatus.foldersFound}
							/>
							<MiniStat label="新增" value={cloudreveStatus.added} />
							<MiniStat label="更新" value={cloudreveStatus.updated} />
							<MiniStat label="保留" value={cloudreveStatus.kept} />
							<MiniStat label="删除" value={cloudreveStatus.deleted} />
							<MiniStat
								label="耗时"
								value={`${(cloudreveStatus.tookMs / 1000).toFixed(1)}s`}
							/>
						</div>
					) : (
						<EmptyState
							icon={FolderSyncIcon}
							title="尚未执行过 Cloudreve 文件同步"
							description="同步会拉取 Cloudreve 目录并补齐 / 修正文件的路径记录"
							size="sm"
							action={
								<Button
									size="sm"
									variant="outline"
									onClick={() => cloudreveSync.mutate()}
									disabled={cloudreveSync.isPending}
								>
									<PlayIcon className="size-4" />
									立即同步
								</Button>
							}
						/>
					)}

					{cloudreveReport && <CloudreveReport report={cloudreveReport} />}
				</CardContent>
			</Card>
		</div>
	);
}

// ── Cloudreve 文件缺失巡检结果 ────────────────────────

function CloudreveReport({ report }: { report: CloudreveCheckResult }) {
	const hasIssue =
		report.added > 0 ||
		report.updated > 0 ||
		report.deleted > 0 ||
		report.vnWithoutAlistb.samples.length > 0;

	return (
		<div className="flex flex-col gap-3 pt-4 border-t border-border/60">
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
					<div className="flex overflow-y-auto flex-col gap-2 p-3 max-h-48 font-mono text-xs bg-muted/40 rounded-xl ring-1 ring-border/60">
						{report.updatedRows.map((row) => (
							<div key={row.displayId} className="flex flex-col">
								<span className="text-primary">{row.displayId}</span>
								<span className="text-muted-foreground line-through">
									{row.oldPaths.join(" / ") || "（无路径）"}
								</span>
								<span className="text-success">{row.newPaths.join(" / ")}</span>
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
					<div className="flex overflow-y-auto flex-col gap-2 p-3 max-h-48 font-mono text-xs bg-muted/40 rounded-xl ring-1 ring-border/60">
						{report.renamedRows.map((row) => (
							<div key={`${row.fromId}->${row.toId}`} className="flex flex-col">
								<span className="text-primary">
									<span className="line-through">{row.fromId}</span>
									{" → "}
									{row.toId}
								</span>
								<span className="text-success">{row.paths.join(" / ")}</span>
							</div>
						))}
					</div>
				</div>
			)}

			{report.addedRows.length > 0 && (
				<div className="flex flex-col gap-1">
					<p className="text-sm font-medium">Cloudreve 新增文件夹</p>
					<div className="flex overflow-y-auto flex-col gap-1 p-3 max-h-40 font-mono text-xs bg-muted/40 rounded-xl ring-1 ring-border/60">
						{report.addedRows.map((row) => (
							<div key={row.displayId}>
								<span className="text-primary">{row.displayId}</span>{" "}
								{row.paths.join(" / ")}
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
					<div className="flex overflow-y-auto flex-col gap-1 p-3 max-h-40 font-mono text-xs bg-muted/40 rounded-xl ring-1 ring-border/60">
						{report.staleDeadRows.map((row) => (
							<div key={row.displayId}>
								<span className="text-primary">{row.displayId}</span>{" "}
								{row.paths.join(" / ")}
							</div>
						))}
					</div>
				</div>
			)}

			{report.staleAliveRows.length > 0 && (
				<p className="text-xs text-muted-foreground">
					搜索结果缺失但路径仍存在 {report.staleAliveRows.length}{" "}
					个（保留不动）：
					{report.staleAliveRows.map((row) => row.displayId).join(", ")}
				</p>
			)}

			{report.vnWithoutAlistb.samples.length > 0 && (
				<div className="flex flex-col gap-1">
					<p className="text-sm font-medium">
						有 VNDB 数据但无文件条目（文件夹已删除或改名，共{" "}
						{report.vnWithoutAlistb.total}
						{report.vnWithoutAlistb.truncated ? "+" : ""} 个）
					</p>
					<div className="flex overflow-y-auto flex-wrap gap-x-2 gap-y-1 p-3 max-h-32 font-mono text-xs bg-muted/40 rounded-xl ring-1 ring-border/60">
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
