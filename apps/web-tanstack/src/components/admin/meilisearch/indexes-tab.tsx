import { useQuery } from "@tanstack/react-query";
import { StatusPill } from "@web/components/admin/admin-table";
import { ConfirmDialog } from "@web/components/admin/confirm-dialog";
import { IconTile } from "@web/components/shared/icon-tile";
import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@web/components/ui/card";
import { Progress } from "@web/components/ui/progress";
import { Separator } from "@web/components/ui/separator";
import { adminKeys } from "@web/lib/admin/query-keys";
import { cn } from "@web/lib/utils";
import { getMeiliSearchProgress } from "@web/server/admin/meilisearch";
import {
	AlertTriangleIcon,
	CheckCircleIcon,
	DatabaseIcon,
	RefreshCwIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	ErrorDisplay,
	extractError,
	formatTime,
	ignoreAbort,
	indexTypeLabels,
	Panel,
	SectionHeader,
	StatusBadge,
	useRebuildIndex,
} from "./shared";
import type { IndexType, MeiliLogEntry, MeiliProgress } from "./types";

// ─── 日志级别 ─────────────────────────────────────────────────

const logLevelConfig: Record<
	MeiliLogEntry["level"],
	{
		icon: typeof CheckCircleIcon | typeof AlertTriangleIcon | null;
		className: string;
	}
> = {
	info: { icon: null, className: "text-muted-foreground" },
	success: { icon: CheckCircleIcon, className: "text-success" },
	error: { icon: AlertTriangleIcon, className: "text-destructive" },
};

// ─── 单个索引的重建卡 ────────────────────────────────────────

function RebuildCard({
	type,
	description,
}: {
	type: IndexType;
	description: string;
}) {
	const label = indexTypeLabels[type];
	const fullLabel = `${label}索引`;
	const logsRef = useRef<HTMLDivElement>(null);
	// 触发后到 worker 真正拉起之间的窗口：保持「重建中」并加速轮询
	const boostPollUntilRef = useRef(0);
	const [queued, setQueued] = useState(false);
	const [confirmOpen, setConfirmOpen] = useState(false);

	const {
		data: raw,
		isLoading,
		isFetching,
		error,
		refetch,
	} = useQuery({
		queryKey: adminKeys.meiliIndexes(type),
		queryFn: ignoreAbort(() => getMeiliSearchProgress({ data: { type } })),
		// 只在重建中（或刚触发的加速窗口内）高频轮询，空闲不空转
		refetchInterval: (query) => {
			const data = query.state.data as MeiliProgress | undefined;
			if (data?.status === "running") return 2000;
			return boostPollUntilRef.current > Date.now() ? 2000 : false;
		},
	});

	const rebuild = useRebuildIndex(type, {
		mutationKey: ["admin", "meili", "rebuild", type],
	});

	const progress = raw as MeiliProgress | undefined;
	const status = progress?.status ?? "idle";
	const isRunning = status === "running" || queued;
	const totalPages = progress?.totalPages ?? 0;
	const processedPages = progress?.processedPages ?? 0;
	const progressPercent =
		totalPages > 0 ? Math.round((processedPages / totalPages) * 100) : 0;
	const errors = progress?.errors ?? 0;
	const logs = progress?.logs ?? [];

	useEffect(() => {
		if (logsRef.current) {
			logsRef.current.scrollTop = logsRef.current.scrollHeight;
		}
	}, [logs.length]);

	// worker 拉起后清掉「已触发」标记；超时兜底避免一直挂着
	useEffect(() => {
		if (!queued) return;
		if (progress?.status === "running") {
			setQueued(false);
			return;
		}
		const timer = setTimeout(() => setQueued(false), 60_000);
		return () => clearTimeout(timer);
	}, [queued, progress?.status]);

	// 跑完就退出加速轮询
	useEffect(() => {
		if (progress?.status === "completed" || progress?.status === "failed") {
			boostPollUntilRef.current = 0;
		}
	}, [progress?.status]);

	return (
		<div className="flex flex-col gap-3 p-4 bg-card rounded-2xl ring-1 ring-border/60">
			<SectionHeader
				title={fullLabel}
				description={description}
				action={
					<StatusBadge
						status={
							isRunning
								? "running"
								: status === "completed"
									? "completed"
									: status === "failed"
										? "failed"
										: "idle"
						}
					/>
				}
			/>

			<div
				className={cn(
					"flex flex-col gap-3 transition-opacity duration-200",
					isFetching && !isLoading && "opacity-60",
				)}
			>
				{isLoading ? (
					<div className="space-y-2" aria-busy="true">
						<div className="h-1.5 bg-muted rounded-full animate-pulse" />
						<div className="w-2/3 h-3 bg-muted rounded animate-pulse" />
					</div>
				) : error ? (
					<ErrorDisplay
						message={extractError(error)}
						onRetry={() => refetch()}
					/>
				) : status !== "idle" || isRunning ? (
					<>
						<div className="flex flex-col gap-1.5">
							<div className="flex justify-between items-center text-xs text-muted-foreground">
								<span className="tabular-nums">
									{totalPages > 0
										? `${processedPages} / ${totalPages} 页`
										: isRunning
											? "准备中…"
											: "—"}
								</span>
								<span className="tabular-nums">{progressPercent}%</span>
							</div>
							{totalPages > 0 ? (
								<Progress value={progressPercent} />
							) : isRunning ? (
								<div className="overflow-hidden w-full h-2 bg-muted rounded-full">
									<div className="h-full bg-primary rounded-full animate-pulse" />
								</div>
							) : null}
						</div>

						<div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
							{progress?.startedAt && (
								<span>开始: {formatTime(progress.startedAt)}</span>
							)}
							{progress?.completedAt && (
								<span>完成: {formatTime(progress.completedAt)}</span>
							)}
						</div>

						{errors > 0 && (
							<Badge variant="destructive" className="gap-1 w-fit text-xs">
								<AlertTriangleIcon className="size-3" />
								{errors} 个错误
							</Badge>
						)}

						{logs.length > 0 && (
							<div
								ref={logsRef}
								className="overflow-y-auto p-2.5 space-y-0.5 max-h-36 font-mono text-xs bg-muted/40 rounded-xl ring-1 ring-border/60"
							>
								{logs.map((log, index) => {
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
								})}
							</div>
						)}
					</>
				) : (
					<Panel className="text-xs text-muted-foreground">
						暂无重建记录。触发重建后会在这里实时显示页进度与日志。
					</Panel>
				)}
			</div>

			<Button
				variant="outline"
				size="sm"
				className="w-full"
				disabled={rebuild.isPending || isRunning}
				onClick={() => setConfirmOpen(true)}
			>
				<RefreshCwIcon
					className={cn("size-3.5", rebuild.isPending && "animate-spin")}
				/>
				重建{fullLabel}
			</Button>

			<ConfirmDialog
				open={confirmOpen}
				onOpenChange={setConfirmOpen}
				title={`确认重建${fullLabel}`}
				desc={
					<>
						此操作将清空现有的{fullLabel}
						数据，并从数据库重新导入所有文档。重建过程通常需要数分钟，期间搜索功能可能暂时不可用。
					</>
				}
				confirmText="确认重建"
				destructive
				isLoading={rebuild.isPending}
				onConfirm={() => {
					boostPollUntilRef.current = Date.now() + 60_000;
					setQueued(true);
					rebuild.mutate();
					setConfirmOpen(false);
				}}
			/>
		</div>
	);
}

// ─── Tab ─────────────────────────────────────────────────────

export function IndexesTab() {
	return (
		<div className="flex flex-col gap-4">
			<Card>
				<CardHeader>
					<CardTitle className="flex gap-2.5 items-center text-base">
						<IconTile icon={DatabaseIcon} size="sm" tone="muted" />
						索引重建
					</CardTitle>
					<CardDescription>
						手动触发索引重建。重建会清空现有索引并从数据库重新导入全部数据，耗时通常数分钟；触发后此处实时显示进度。
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						<RebuildCard
							type="game"
							description="重建 Galgame 游戏数据的全文搜索索引"
						/>
						<RebuildCard type="tag" description="重建标签数据的全文搜索索引" />
						<RebuildCard
							type="producer"
							description="重建厂商 / 开发会社数据的全文搜索索引"
						/>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex gap-2.5 items-center text-base">
						<IconTile icon={RefreshCwIcon} size="sm" tone="muted" />
						自动调度
					</CardTitle>
					<CardDescription>Meilisearch 索引相关的定时任务</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-2">
					<div className="flex flex-wrap gap-2.5 items-center text-sm">
						<Badge variant="outline" className="font-mono text-xs tabular-nums">
							每周日 03:00
						</Badge>
						<span>游戏索引全量重建</span>
						<StatusPill tone="neutral" className="ml-auto">
							定时
						</StatusPill>
					</div>
					<Separator />
					<div className="flex flex-wrap gap-2.5 items-center text-sm">
						<Badge variant="outline" className="font-mono text-xs tabular-nums">
							每周日 03:00
						</Badge>
						<span>标签索引全量重建</span>
						<StatusPill tone="neutral" className="ml-auto">
							定时
						</StatusPill>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
