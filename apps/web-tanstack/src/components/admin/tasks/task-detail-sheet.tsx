import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@web/components/shared/empty-state";
import { Button } from "@web/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "@web/components/ui/drawer";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@web/components/ui/sheet";
import { Skeleton } from "@web/components/ui/skeleton";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@web/components/ui/tabs";
import { adminKeys } from "@web/lib/admin/query-keys";
import { isTerminalStatus } from "@web/lib/admin/tasks/labels";
import {
	getTaskDetail,
	type ParsedApiError,
	parseApiError,
} from "@web/server/admin/tasks";
import {
	AlertTriangleIcon,
	BracesIcon,
	DatabaseIcon,
	InboxIcon,
	RotateCwIcon,
	ScrollTextIcon,
} from "lucide-react";
import { TaskDetailHeader } from "./task-detail/task-detail-header";
import { TaskDetailMeta } from "./task-detail/task-detail-meta";
import { TaskJsonBlock } from "./task-detail/task-json-block";
import { TaskLogConsole } from "./task-detail/task-log-console";
import { useIsWideViewport } from "./task-detail/use-media-query";

/**
 * 任务详情抽屉。
 *
 * 容器选择由视口决定（≥1024 右侧 Sheet 480px，否则底部 Drawer 90dvh），
 * 两种容器共用同一个 `?job=<id>` 状态，因此：
 * - 详情独立取数（getTaskDetail），不依赖「该行在当前页」，深链/翻页都能打开；
 * - 768–1023 不再出现旧页面「桌面侧栏被 hidden、移动抽屉又不渲染」的空洞。
 *
 * 轮询只在非终态任务上开启（2s），终态任务停止请求；日志另走增量轮询。
 */

/** 非终态任务的详情轮询间隔。 */
const DETAIL_POLL_INTERVAL_MS = 2000;

export type TaskDetailSheetProps = {
	/** 详情任务 ID（来自 URL 的 ?job=）。为空时不渲染抽屉 */
	jobId?: string;
	onClose: () => void;
};

export function TaskDetailSheet({ jobId, onClose }: TaskDetailSheetProps) {
	const isWide = useIsWideViewport(1024);

	const detail = useQuery({
		queryKey: adminKeys.taskDetail(jobId ?? ""),
		queryFn: () => getTaskDetail({ data: { jobId: jobId as string } }),
		enabled: Boolean(jobId),
		refetchInterval: (query) =>
			query.state.data && !isTerminalStatus(query.state.data.status)
				? DETAIL_POLL_INTERVAL_MS
				: false,
		refetchIntervalInBackground: false,
	});

	// 挂载前（isWide === null）不渲染，避免 SSR/客户端容器不一致
	if (!jobId || isWide === null) return null;

	const job = detail.data ?? null;
	const parsedError: ParsedApiError | null = detail.error
		? parseApiError(detail.error)
		: null;

	const header = (
		<TaskDetailHeader
			job={job}
			isFetching={detail.isFetching && !detail.isLoading}
			onClose={onClose}
		/>
	);

	const body = (
		<div className="flex flex-col gap-3">
			{detail.isLoading ? (
				<DetailSkeleton />
			) : job ? (
				// 有旧数据时轮询失败不清空详情（避免「刷新一次闪一下错误」）
				<TaskDetailContent jobId={jobId} job={job} />
			) : parsedError?.code === "TASK_NOT_FOUND" ? (
				<TaskMissingState onClose={onClose} />
			) : parsedError ? (
				<DetailErrorState
					error={parsedError}
					onRetry={() => void detail.refetch()}
				/>
			) : (
				<TaskMissingState onClose={onClose} />
			)}
		</div>
	);

	if (isWide) {
		return (
			<Sheet
				open
				onOpenChange={(open) => {
					if (!open) onClose();
				}}
			>
				<SheetContent
					side="right"
					showCloseButton={false}
					className="gap-0 p-0"
					// sheet.tsx 自带 data-[side=right]:w-3/4 与 sm:max-w-sm，同权重工具类
					// 的先后不可控；480px 宽只能靠内联样式覆盖。
					style={{ width: "480px", maxWidth: "92vw" }}
				>
					<SheetHeader className="gap-0 p-4 border-b border-border/60">
						<SheetTitle className="sr-only">任务详情</SheetTitle>
						<SheetDescription className="sr-only">
							任务状态、时间线、执行日志与载荷
						</SheetDescription>
						{header}
					</SheetHeader>
					<div className="flex-1 min-h-0 overflow-y-auto p-4">{body}</div>
				</SheetContent>
			</Sheet>
		);
	}

	return (
		<Drawer
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DrawerContent
				showCloseButton={false}
				className="overflow-hidden sm:max-w-lg"
				// DrawerContent 自带的 .galzy-max-h-85dvh 是未分层样式，优先级高于
				// Tailwind 工具类；要 90dvh 只能用内联样式覆盖。
				style={{ maxHeight: "90dvh" }}
			>
				<DrawerHeader className="gap-0 p-4 border-b border-border/60">
					<DrawerTitle className="sr-only">任务详情</DrawerTitle>
					<DrawerDescription className="sr-only">
						任务状态、时间线、执行日志与载荷
					</DrawerDescription>
					{header}
				</DrawerHeader>
				<div className="flex-1 min-h-0 overflow-y-auto p-4">{body}</div>
			</DrawerContent>
		</Drawer>
	);
}

function TaskDetailContent({
	jobId,
	job,
}: {
	jobId: string;
	job: NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;
}) {
	return (
		<>
			<TaskDetailMeta job={job} />
			<Tabs defaultValue="logs" className="mt-1 flex flex-col gap-2">
				<TabsList className="w-full">
					<TabsTrigger value="logs">
						<ScrollTextIcon className="size-3.5" />
						日志
					</TabsTrigger>
					<TabsTrigger value="result">
						<BracesIcon className="size-3.5" />
						结果
					</TabsTrigger>
					<TabsTrigger value="payload">
						<DatabaseIcon className="size-3.5" />
						载荷
					</TabsTrigger>
				</TabsList>
				<TabsContent value="logs" className="mt-2">
					<TaskLogConsole
						jobId={jobId}
						running={!isTerminalStatus(job.status)}
					/>
				</TabsContent>
				<TabsContent value="result" className="mt-2">
					<TaskJsonBlock
						value={job.result}
						title="执行结果"
						emptyText="任务尚未产出结果"
					/>
				</TabsContent>
				<TabsContent value="payload" className="mt-2">
					<TaskJsonBlock
						value={job.payload}
						title="任务载荷"
						emptyText="该任务没有载荷"
					/>
				</TabsContent>
			</Tabs>
		</>
	);
}

function TaskMissingState({ onClose }: { onClose: () => void }) {
	return (
		<EmptyState
			icon={InboxIcon}
			title="任务已被清理"
			description="该任务记录不存在，或已超出保留期被清理。"
			size="sm"
			surface
			action={
				<Button variant="outline" size="sm" onClick={onClose}>
					关闭
				</Button>
			}
		/>
	);
}

function DetailSkeleton() {
	return (
		<div className="flex flex-col gap-3" aria-busy="true">
			<div className="flex flex-col gap-1.5">
				<Skeleton className="h-3 w-24" />
				<Skeleton className="h-1.5 w-full" />
			</div>
			<Skeleton className="h-20 w-full rounded-xl" />
			<div className="flex gap-2">
				<Skeleton className="h-8 flex-1" />
				<Skeleton className="h-8 flex-1" />
				<Skeleton className="h-8 flex-1" />
			</div>
			<Skeleton className="h-48 w-full rounded-xl" />
		</div>
	);
}

function DetailErrorState({
	error,
	onRetry,
}: {
	error: ParsedApiError;
	onRetry: () => void;
}) {
	// 403 是权限问题，重试没有意义（错误码由 BFF 编进 message 前缀）
	const retryable = error.code !== "FORBIDDEN";

	return (
		<EmptyState
			icon={AlertTriangleIcon}
			title="任务详情加载失败"
			description={error.message}
			size="sm"
			surface
			action={
				retryable ? (
					<Button variant="outline" size="sm" onClick={onRetry}>
						<RotateCwIcon className="size-3.5" />
						重试
					</Button>
				) : undefined
			}
		/>
	);
}
