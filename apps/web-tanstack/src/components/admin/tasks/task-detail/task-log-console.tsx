import { Button } from "@web/components/ui/button";
import { Skeleton } from "@web/components/ui/skeleton";
import { cn } from "@web/lib/utils";
import {
	listTaskLogs,
	type QueueJobLogRow,
	type TaskLogLevel,
} from "@web/server/admin/tasks";
import {
	AlertTriangleIcon,
	CheckCircleIcon,
	CopyIcon,
	Loader2Icon,
	type LucideIcon,
	RotateCwIcon,
	XCircleIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * 任务日志控制台（详情抽屉的「日志」tab）。
 *
 * 与旧页面的区别：不再每 2s 重取最新 200 条（整段替换、滚动位置乱跳），
 * 而是用 `afterId` 做**增量**拉取——只把新行追加到本地累积数组，
 * 时间顺序按日志 id 归一化，因此后端无论升序还是降序返回都能正确拼。
 *
 * 级别过滤（全部 / 警告+ / 仅错误）在前端对累积数组做，仅影响展示，
 * 不重新请求：切回「全部」时历史日志仍在。
 *
 * TODO(api): 若某任务日志超过首次拉取的 limit，更早的历史当前不可见；
 * 契约 V2 稳定后可补「加载更早日志」的 beforeId 参数。
 */

/** 轮询间隔：与详情查询一致（仅非终态轮询）。 */
const POLL_INTERVAL_MS = 2000;

/** 单次增量拉取的条数上限。 */
const LOG_PAGE_LIMIT = 200;

type LogLevelFilter = "all" | "warn" | "error";

const LEVEL_FILTERS: ReadonlyArray<{ key: LogLevelFilter; label: string }> = [
	{ key: "all", label: "全部" },
	{ key: "warn", label: "警告+" },
	{ key: "error", label: "仅错误" },
];

const LOG_LEVEL_STYLES: Record<
	TaskLogLevel,
	{ icon: LucideIcon | null; className: string }
> = {
	info: { icon: null, className: "text-muted-foreground" },
	warn: { icon: AlertTriangleIcon, className: "text-warning" },
	error: { icon: XCircleIcon, className: "text-destructive" },
	success: { icon: CheckCircleIcon, className: "text-success" },
};

/** 合并两批日志：按 id 去重 + 升序排列（控制台永远从旧到新读）。 */
function mergeLogs(
	previous: QueueJobLogRow[],
	incoming: QueueJobLogRow[],
): QueueJobLogRow[] {
	if (incoming.length === 0) return previous;
	const byId = new Map<number, QueueJobLogRow>();
	for (const log of previous) byId.set(log.id, log);
	for (const log of incoming) byId.set(log.id, log);
	return [...byId.values()].sort((a, b) => a.id - b.id);
}

function formatClock(input: string): string {
	const date = new Date(input);
	if (Number.isNaN(date.getTime())) return "--:--:--";
	return date.toLocaleTimeString("zh-CN", { hour12: false });
}

export type TaskLogConsoleProps = {
	jobId: string;
	/** 任务是否仍在执行（非终态才继续轮询） */
	running: boolean;
	className?: string;
};

export function TaskLogConsole({
	jobId,
	running,
	className,
}: TaskLogConsoleProps) {
	const [logs, setLogs] = useState<QueueJobLogRow[]>([]);
	const [level, setLevel] = useState<LogLevelFilter>("all");
	const [autoScroll, setAutoScroll] = useState(true);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<unknown>(null);
	const [attempt, setAttempt] = useState(0);

	const afterIdRef = useRef<number | null>(null);
	const runningRef = useRef(running);
	const scrollRef = useRef<HTMLDivElement | null>(null);

	// 用 ref 读轮询时机的最新值，避免把 running 塞进 tick 的闭包
	useEffect(() => {
		runningRef.current = running;
	}, [running]);

	// 切换任务时重置增量游标与累积日志：抽屉在任务之间切换不能串日志
	useEffect(() => {
		afterIdRef.current = null;
		setLogs([]);
		setError(null);
		setIsLoading(true);
	}, [jobId]);

	useEffect(() => {
		let cancelled = false;
		let timer: number | undefined;

		const tick = async () => {
			try {
				const page = await listTaskLogs({
					data: {
						jobId,
						limit: LOG_PAGE_LIMIT,
						...(afterIdRef.current !== null
							? { afterId: afterIdRef.current }
							: {}),
					},
				});
				if (cancelled) return;

				setError(null);
				setIsLoading(false);
				if (page.items.length > 0) {
					setLogs((previous) => mergeLogs(previous, page.items));
				}

				const lastId =
					page.items.length > 0
						? page.items[page.items.length - 1]?.id
						: undefined;
				const nextAfterId = page.nextAfterId ?? lastId;
				if (typeof nextAfterId === "number") {
					afterIdRef.current = nextAfterId;
				}
			} catch (caught) {
				if (cancelled) return;
				setError(caught);
				setIsLoading(false);
			}

			if (!cancelled && runningRef.current) {
				timer = window.setTimeout(() => void tick(), POLL_INTERVAL_MS);
			}
		};

		void tick();

		return () => {
			cancelled = true;
			if (timer !== undefined) window.clearTimeout(timer);
		};
	}, [jobId, running, attempt]);

	const visibleLogs = useMemo(() => {
		if (level === "all") return logs;
		if (level === "warn") {
			return logs.filter(
				(log) => log.level === "warn" || log.level === "error",
			);
		}
		return logs.filter((log) => log.level === "error");
	}, [logs, level]);

	// 只在「行数变化」时滚到底：切换级别过滤不改变阅读位置
	useEffect(() => {
		if (!autoScroll) return;
		const element = scrollRef.current;
		if (element) element.scrollTop = element.scrollHeight;
	}, [visibleLogs.length, autoScroll]);

	const copyAll = async () => {
		if (visibleLogs.length === 0) return;
		const text = visibleLogs
			.map(
				(log) =>
					`[${formatClock(log.createdAt)}] ${log.level.toUpperCase()} ${log.message}`,
			)
			.join("\n");
		try {
			await navigator.clipboard.writeText(text);
			toast.success("日志已复制");
		} catch {
			toast.error("复制失败，请手动选择文本");
		}
	};

	return (
		<div className={cn("flex flex-col gap-2 min-h-0", className)}>
			<div className="flex flex-wrap gap-1.5 items-center">
				{LEVEL_FILTERS.map((item) => (
					<button
						key={item.key}
						type="button"
						aria-pressed={level === item.key}
						onClick={() => setLevel(item.key)}
						className={cn(
							"px-2 h-6 text-[11px] font-medium rounded-md transition-colors",
							level === item.key
								? "text-foreground bg-muted"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{item.label}
					</button>
				))}
				<span className="ml-auto flex gap-1 items-center">
					{running && (
						<span className="flex gap-1 items-center text-[11px] text-info">
							<Loader2Icon className="size-3 animate-spin" />
							实时
						</span>
					)}
					<button
						type="button"
						aria-pressed={autoScroll}
						onClick={() => setAutoScroll((value) => !value)}
						className={cn(
							"px-2 h-6 text-[11px] font-medium rounded-md transition-colors",
							autoScroll
								? "text-info bg-info/10"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{autoScroll ? "自动滚动" : "已暂停"}
					</button>
					<Button
						variant="ghost"
						size="icon-xs"
						aria-label="复制全部日志"
						className="text-muted-foreground"
						onClick={() => void copyAll()}
					>
						<CopyIcon className="size-3" />
					</Button>
				</span>
			</div>

			<div
				ref={scrollRef}
				role="log"
				aria-live="polite"
				aria-busy={isLoading}
				className="overflow-y-auto p-2.5 max-h-72 min-h-24 font-mono text-[11px] leading-relaxed bg-muted/50 rounded-xl ring-1 ring-border/40"
			>
				{isLoading ? (
					<div
						role="status"
						aria-label="日志加载中"
						className="flex flex-col gap-1.5"
					>
						<Skeleton className="h-3 w-3/4" />
						<Skeleton className="h-3 w-2/3" />
						<Skeleton className="h-3 w-1/2" />
					</div>
				) : error ? (
					<div className="flex flex-col gap-2 justify-center items-center py-4 text-destructive">
						<p>日志加载失败</p>
						<Button
							variant="outline"
							size="xs"
							onClick={() => setAttempt((value) => value + 1)}
						>
							<RotateCwIcon className="size-3" />
							重试
						</Button>
					</div>
				) : visibleLogs.length === 0 ? (
					<p className="py-4 text-center text-muted-foreground">
						{logs.length === 0 ? "暂无日志" : "当前级别下没有日志"}
					</p>
				) : (
					visibleLogs.map((log) => {
						const style = LOG_LEVEL_STYLES[log.level] ?? LOG_LEVEL_STYLES.info;
						const Icon = style.icon;
						return (
							<div
								key={log.id}
								className={cn("flex gap-1.5 items-start", style.className)}
							>
								<span className="shrink-0 text-muted-foreground/60">
									{formatClock(log.createdAt)}
								</span>
								{Icon && <Icon className="shrink-0 mt-0.5 size-3" />}
								<span className="break-all whitespace-pre-wrap">
									{log.message}
								</span>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
