import { useQuery } from "@tanstack/react-query";
import { AdminPageHeader } from "@web/components/admin/admin-page-header";
import { StatusPill, type StatusTone } from "@web/components/admin/admin-table";
import { IconTile } from "@web/components/shared/icon-tile";
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
	getKungalSyncProgress,
	triggerKungalCharactersSync,
	triggerKungalDeltaSync,
	triggerKungalFullSync,
	triggerKungalWalkthroughsSync,
} from "@web/server/admin/kungal-sync";
import type { LucideIcon } from "lucide-react";
import {
	AlertCircleIcon,
	CheckCircleIcon,
	Clock3Icon,
	DatabaseZapIcon,
	Loader2Icon,
	PlayIcon,
	RefreshCwIcon,
	RouteIcon,
	TimerIcon,
	TriangleAlertIcon,
	UserRoundIcon,
	XCircleIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
	kungalProgressPercent,
	kungalStageLabel,
	kungalTypeLabel,
} from "./kungal-sync-labels";

/**
 * Kungal 数据同步面板。
 *
 * 为什么单独一页：kungal（NextMoe·未萌）现在是站内的主数据源——作品、角色、
 * 攻略都只从它取，VNDB 只剩「作品锚点」这一个用途。原来的 /admin/vndb-sync
 * 只覆盖 VNDB 自己的 vn/tags/releases/producers 阶段，kungal 的
 * resolve/works/characters/walkthroughs/cache 五个阶段在后台没有任何展示，
 * 运维只能靠日志猜进度。
 */

type SyncType = "full" | "delta" | "characters" | "walkthroughs";

const statusConfig: Record<
	string,
	{ label: string; tone: StatusTone; icon?: LucideIcon; spin?: boolean }
> = {
	idle: { label: "空闲", tone: "neutral", icon: Clock3Icon },
	running: { label: "运行中", tone: "info", icon: Loader2Icon, spin: true },
	completed: { label: "已完成", tone: "success", icon: CheckCircleIcon },
	failed: { label: "失败", tone: "destructive", icon: XCircleIcon },
};

const logLevelConfig: Record<
	string,
	{ icon: LucideIcon | null; className: string }
> = {
	info: { icon: null, className: "text-muted-foreground" },
	success: { icon: CheckCircleIcon, className: "text-success" },
	error: { icon: AlertCircleIcon, className: "text-destructive" },
};

/** 运行中 2s 轮询，空闲 15s；触发后 60s 内保持快轮询，覆盖「入队 → worker 拉起」空档。 */
const RUNNING_POLL_MS = 2000;
const IDLE_POLL_MS = 15000;
const BOOST_POLL_WINDOW_MS = 60_000;

/** KPI 卡：图标底片 + 数值 + 说明，数字统一 tabular-nums。 */
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
	hint?: string;
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

/** 单个同步动作：按钮 + 乐观提示 + 队列反馈。 */
function SyncAction({
	type,
	icon,
	label,
	description,
	featured,
	onQueued,
	disabled,
}: {
	type: SyncType;
	icon: LucideIcon;
	label: string;
	description: string;
	featured?: boolean;
	onQueued: (type: SyncType) => void;
	disabled?: boolean;
}) {
	const trigger =
		type === "full"
			? triggerKungalFullSync
			: type === "delta"
				? triggerKungalDeltaSync
				: type === "characters"
					? triggerKungalCharactersSync
					: triggerKungalWalkthroughsSync;

	const mutation = useAdminMutation<
		{ ok?: boolean; message?: string } | null,
		void
	>({
		mutationFn: async () => {
			const data = await trigger();
			if (data && data.ok === false) {
				throw new Error(data.message || `${label}触发失败`);
			}
			return data;
		},
		affects: [adminKeys.kungalSyncProgress()],
		successMessage: (data) => data?.message ?? `${label}已入队`,
		errorMessage: (error) =>
			`${label}触发失败：${error instanceof Error ? error.message : String(error)}`,
		onSuccess: () => onQueued(type),
	});

	const Icon = icon;
	return (
		<div className="flex flex-wrap gap-3 justify-between items-center p-3 rounded-xl ring-1 ring-border/60">
			<div className="flex gap-3 items-center min-w-0">
				<IconTile icon={Icon} size="sm" tone={featured ? "primary" : "muted"} />
				<div className="flex flex-col min-w-0">
					<span className="text-sm font-medium">{label}</span>
					<span className="text-xs text-muted-foreground">{description}</span>
				</div>
			</div>
			<Button
				size="sm"
				variant={featured ? "default" : "outline"}
				onClick={() => mutation.mutate()}
				disabled={disabled || mutation.isPending}
			>
				{mutation.isPending ? (
					<Loader2Icon className="size-4 animate-spin" />
				) : (
					<PlayIcon className="size-4" />
				)}
				{mutation.isPending ? "提交中…" : "触发"}
			</Button>
		</div>
	);
}

export function KungalSyncPage() {
	const logsRef = useRef<HTMLDivElement>(null);
	const boostUntilRef = useRef(0);
	const [queuedType, setQueuedType] = useState<SyncType | null>(null);

	const { data: progress, dataUpdatedAt } = useQuery({
		queryKey: adminKeys.kungalSyncProgress(),
		queryFn: () => getKungalSyncProgress(),
		refetchInterval: (query) => {
			if (boostUntilRef.current > Date.now()) return RUNNING_POLL_MS;
			return query.state.data?.status === "running"
				? RUNNING_POLL_MS
				: IDLE_POLL_MS;
		},
	});

	// 服务端真正进入 running 后清掉「已入队」标记；超时兜底避免一直挂着
	useEffect(() => {
		if (!queuedType) return;
		if (progress?.status === "running") {
			setQueuedType(null);
			return;
		}
		const timer = setTimeout(() => setQueuedType(null), 60_000);
		return () => clearTimeout(timer);
	}, [queuedType, progress?.status]);

	// 日志自动滚到底部
	useEffect(() => {
		const el = logsRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [progress?.logs]);

	const handleQueued = (type: SyncType) => {
		boostUntilRef.current = Date.now() + BOOST_POLL_WINDOW_MS;
		setQueuedType(type);
	};

	const isRunning = progress?.status === "running" || queuedType !== null;
	// 入队到 worker 拉起之间有窗口：这段窗口内按「运行中」展示，避免按钮闪回可用态
	const displayStatus =
		queuedType && progress?.status !== "running"
			? "running"
			: (progress?.status ?? "idle");
	const statusMeta = statusConfig[displayStatus] ?? statusConfig.idle;
	const StatusIcon = statusMeta.icon;
	const percent = kungalProgressPercent(progress);
	const stageLabel = kungalStageLabel(progress?.stage);
	const typeLabel = kungalTypeLabel(progress?.type);

	return (
		<div className="space-y-4">
			<AdminPageHeader
				eyebrow="系统"
				icon={DatabaseZapIcon}
				title="Kungal 数据同步"
				description="作品、角色、攻略的唯一数据源；VNDB 只作为作品锚点映射，不再从这里取数据。"
				actions={
					<div className="flex flex-wrap gap-2 items-center">
						<StatusPill
							tone={statusMeta.tone}
							icon={StatusIcon}
							spin={statusMeta.spin}
						>
							{queuedType && progress?.status !== "running"
								? "已入队"
								: statusMeta.label}
						</StatusPill>
						{typeLabel && (
							<StatusPill tone="neutral" icon={TimerIcon}>
								{typeLabel}
							</StatusPill>
						)}
					</div>
				}
			/>

			{/* ── 进度总览 ─────────────────────────────────────── */}
			<Card>
				<CardHeader>
					<div className="flex flex-wrap gap-2 justify-between items-center">
						<CardTitle className="flex gap-2.5 items-center text-base">
							<IconTile icon={RefreshCwIcon} size="sm" tone="muted" />
							同步进度
						</CardTitle>
						{isRunning && (
							<StatusPill tone="info" icon={Loader2Icon} spin>
								同步中
							</StatusPill>
						)}
					</div>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<div className="flex justify-between items-center text-xs text-muted-foreground">
							<span>
								{stageLabel
									? `当前阶段：${stageLabel}`
									: progress?.status === "completed"
										? "本轮已完成"
										: "等待任务开始"}
							</span>
							<span className="tabular-nums">{percent}%</span>
						</div>
						<Progress value={percent} />
					</div>

					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
						<KpiCard
							icon={DatabaseZapIcon}
							label="已处理作品"
							value={
								progress
									? `${progress.processedItems} / ${progress.totalItems}`
									: "—"
							}
							hint={`命中锚点 ${progress?.resolvedCount ?? 0}`}
							tone="primary"
						/>
						<KpiCard
							icon={UserRoundIcon}
							label="角色"
							value={progress?.charactersUpserted ?? 0}
							hint={`名册 ${progress?.appearancesUpserted ?? 0} · 作品 ${progress?.characterTotal ?? 0}`}
							tone="info"
						/>
						<KpiCard
							icon={RouteIcon}
							label="攻略"
							value={progress?.walkthroughsUpserted ?? 0}
							hint={`详情 ${progress?.walkthroughDetails ?? 0} · 下线 ${progress?.walkthroughsRemoved ?? 0}`}
							tone="success"
						/>
						<KpiCard
							icon={TriangleAlertIcon}
							label="错误"
							value={progress?.errors ?? 0}
							hint="单批失败只计数，不中断整轮"
							tone={(progress?.errors ?? 0) > 0 ? "destructive" : "muted"}
						/>
						<KpiCard
							icon={TimerIcon}
							label="最近更新"
							value={
								progress?.lastUpdated
									? new Date(progress.lastUpdated).toLocaleTimeString()
									: "—"
							}
							hint={
								progress?.startedAt
									? `开始 ${new Date(progress.startedAt).toLocaleString()}`
									: undefined
							}
						/>
					</div>

					<div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
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
							{progress?.logs?.length ? (
								progress.logs.map((log, index) => {
									const config =
										logLevelConfig[log.level] ?? logLevelConfig.info;
									const LogIcon = config.icon;
									return (
										<div
											// biome-ignore lint/suspicious/noArrayIndexKey: 日志按时间追加，索引即稳定展示顺序
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
				</CardContent>
			</Card>

			{/* ── 触发入口 ─────────────────────────────────────── */}
			<Card>
				<CardHeader>
					<CardTitle className="flex gap-2.5 items-center text-base">
						<IconTile icon={PlayIcon} size="sm" tone="muted" />
						同步入口
					</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-3 lg:grid-cols-2">
					<SyncAction
						type="full"
						icon={DatabaseZapIcon}
						label="全量同步"
						description="作品 → 角色 → 攻略一轮到底，首次上线或目录大改后使用。"
						featured
						onQueued={handleQueued}
						disabled={isRunning}
					/>
					<SyncAction
						type="delta"
						icon={RefreshCwIcon}
						label="增量同步"
						description="只处理新增/变更作品，并顺带补一批历史缺口。"
						onQueued={handleQueued}
						disabled={isRunning}
					/>
					<SyncAction
						type="characters"
						icon={UserRoundIcon}
						label="只跑角色"
						description="作品没变、只想补角色资料与名册时用。"
						onQueued={handleQueued}
						disabled={isRunning}
					/>
					<SyncAction
						type="walkthroughs"
						icon={RouteIcon}
						label="只跑攻略"
						description="按更新时间跳过没变的攻略，重复触发很便宜。"
						onQueued={handleQueued}
						disabled={isRunning}
					/>
				</CardContent>
			</Card>
		</div>
	);
}
