import { type QueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { EmptyState } from "@web/components/shared/empty-state";
import { Badge } from "@web/components/ui/badge";
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
import { useAdminMutation } from "@web/hooks/use-admin-mutation";
import { formatRelativeTime } from "@web/lib/admin/optimistic";
import { adminKeys } from "@web/lib/admin/query-keys";
import { queueLabel, taskTypeLabel } from "@web/lib/admin/tasks/labels";
import {
	useBatchRemove,
	useBatchRepublish,
} from "@web/lib/admin/tasks/mutations";
import { cn } from "@web/lib/utils";
import {
	type DeadLetterJobRow,
	listDeadLetters,
	parseApiError,
	type RemoveDeadLetterResult,
	type RepublishDeadLetterResult,
	removeDeadLetterTask,
	republishDeadLetterTask,
} from "@web/server/admin/tasks";
import {
	AlertTriangleIcon,
	CheckCircleIcon,
	CopyIcon,
	Loader2Icon,
	RefreshCwIcon,
	RotateCwIcon,
	Trash2Icon,
	XIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useIsWideViewport } from "./task-detail/use-media-query";

/**
 * 死信抽屉：按队列查看 DLQ 快照，支持单条重放/丢弃与勾选后批量操作。
 *
 * - 列表用 `listDeadLetters`（envelope + hasMore）驱动「加载更多」，
 *   不做页码分页：死信会随重放/丢弃消失，页码会跳格；
 * - 单条操作走 useAdminMutation + 乐观移除（这一条已经从死信里消失）；
 * - 批量操作**不做逐条乐观删除**（部分成功时先删后拉回会闪），
 *   只在完成后整体失效，toast 汇总成功/失败数。
 */

/** 死信单页条数（与后端上限 500 对齐但取更小值，减少首屏等待）。 */
const DLQ_PAGE_SIZE = 50;

type DlqInfiniteCache = {
	pages?: Array<{ items: DeadLetterJobRow[] }>;
	pageParams?: unknown[];
};

/** 从无限查询缓存里移除若干条死信（乐观删除）。 */
function removeDlqItems(
	queryClient: QueryClient,
	queryKey: readonly unknown[],
	ids: string[],
): void {
	if (ids.length === 0) return;
	const idSet = new Set(ids);
	queryClient.setQueriesData({ queryKey }, (old: unknown) => {
		if (typeof old !== "object" || old === null) return old;
		const cache = old as DlqInfiniteCache;
		if (!Array.isArray(cache.pages)) return old;
		return {
			...cache,
			pages: cache.pages.map((page) => ({
				...page,
				items: page.items.filter((item) => !idSet.has(item.id)),
			})),
		};
	});
}

export type DeadLetterSheetProps = {
	/** 要查看的队列名；null 表示关闭 */
	queue: string | null;
	onClose: () => void;
};

export function DeadLetterSheet({ queue, onClose }: DeadLetterSheetProps) {
	const isWide = useIsWideViewport(1024);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

	const listKey = adminKeys.taskDeadLetters(queue ?? "");

	const list = useInfiniteQuery({
		queryKey: listKey,
		queryFn: ({ pageParam }) =>
			listDeadLetters({
				data: {
					queue: queue as string,
					pageSize: DLQ_PAGE_SIZE,
					pageIndex: pageParam,
				},
			}),
		initialPageParam: 0,
		getNextPageParam: (lastPage, allPages) =>
			lastPage.hasMore ? allPages.length : undefined,
		enabled: Boolean(queue),
		staleTime: 10_000,
	});

	// 换队列时清空勾选：不能让上一个队列的选择带到下一个
	useEffect(() => {
		setSelectedIds(new Set());
	}, [queue]);

	const republishOne = useAdminMutation<
		RepublishDeadLetterResult,
		{ jobId: string }
	>({
		mutationFn: ({ jobId }) =>
			republishDeadLetterTask({ data: { queue: queue as string, jobId } }),
		affects: [adminKeys.tasksRoot()],
		optimistic: (queryClient, { jobId }) =>
			removeDlqItems(queryClient, listKey, [jobId]),
		successMessage: "已重放回队列",
	});

	const removeOne = useAdminMutation<RemoveDeadLetterResult, { jobId: string }>(
		{
			mutationFn: ({ jobId }) =>
				removeDeadLetterTask({ data: { queue: queue as string, jobId } }),
			affects: [adminKeys.tasksRoot()],
			optimistic: (queryClient, { jobId }) =>
				removeDlqItems(queryClient, listKey, [jobId]),
			successMessage: "死信已丢弃",
		},
	);

	const batchRepublish = useBatchRepublish({
		onSuccess: () => setSelectedIds(new Set()),
	});
	const batchRemove = useBatchRemove({
		onSuccess: () => setSelectedIds(new Set()),
	});

	const items = useMemo(() => {
		const pages = list.data?.pages ?? [];
		const seen = new Set<string>();
		const result: DeadLetterJobRow[] = [];
		for (const page of pages) {
			for (const item of page.items) {
				if (seen.has(item.id)) continue;
				seen.add(item.id);
				result.push(item);
			}
		}
		return result;
	}, [list.data]);

	if (!queue || isWide === null) return null;

	const selectedJobIds = items
		.filter((item) => selectedIds.has(item.id))
		.map((item) => item.id);
	const selectedCount = selectedJobIds.length;
	const allSelected =
		items.length > 0 && items.every((item) => selectedIds.has(item.id));
	const pending =
		republishOne.isPending ||
		removeOne.isPending ||
		batchRepublish.isPending ||
		batchRemove.isPending;

	const toggleAll = (next: boolean) => {
		setSelectedIds(next ? new Set(items.map((item) => item.id)) : new Set());
	};

	const toggleOne = (id: string, next: boolean) => {
		setSelectedIds((previous) => {
			const copy = new Set(previous);
			if (next) copy.add(id);
			else copy.delete(id);
			return copy;
		});
	};

	const republishSelected = () => {
		if (selectedJobIds.length === 0) return;
		batchRepublish.mutate({ queue, jobIds: selectedJobIds });
	};

	const removeSelected = () => {
		if (selectedJobIds.length === 0) return;
		batchRemove.mutate({ queue, jobIds: selectedJobIds });
	};

	const copyJobId = async (jobId: string) => {
		try {
			await navigator.clipboard.writeText(jobId);
			toast.success("任务 ID 已复制");
		} catch {
			toast.error("复制失败");
		}
	};

	const header = (
		<div className="flex gap-2 justify-between items-start">
			<div className="flex flex-col gap-1 min-w-0">
				<div className="flex flex-wrap gap-1.5 items-center">
					<h2 className="text-sm font-semibold">死信队列</h2>
					<Badge variant="secondary">{queueLabel(queue)}</Badge>
					<Badge variant="outline" className="tabular-nums">
						已加载 {items.length}
					</Badge>
				</div>
				<p className="text-[11px] text-muted-foreground">
					超出重试次数被丢弃的任务，可重放回原队列或永久删除
				</p>
			</div>
			<Button
				variant="ghost"
				size="icon-xs"
				aria-label="关闭死信抽屉"
				onClick={onClose}
				className="text-muted-foreground"
			>
				<XIcon className="size-3.5" />
			</Button>
		</div>
	);

	const content = (
		<div className="flex flex-col gap-2">
			{selectedCount > 0 && (
				<div className="flex flex-wrap gap-2 items-center p-2.5 bg-muted/50 rounded-xl ring-1 ring-border/40">
					<span className="text-xs text-muted-foreground">
						已选{" "}
						<span className="font-medium text-foreground tabular-nums">
							{selectedCount}
						</span>{" "}
						条
					</span>
					<div className="flex gap-1.5 items-center ml-auto">
						<Button
							variant="outline"
							size="xs"
							disabled={pending}
							onClick={republishSelected}
						>
							<RefreshCwIcon className="size-3" />
							批量重放
						</Button>
						<Button
							variant="destructive"
							size="xs"
							disabled={pending}
							onClick={removeSelected}
						>
							<Trash2Icon className="size-3" />
							批量丢弃
						</Button>
						<Button
							variant="ghost"
							size="xs"
							disabled={pending}
							aria-label="清空选择"
							onClick={() => setSelectedIds(new Set())}
						>
							<XIcon className="size-3" />
						</Button>
					</div>
				</div>
			)}

			{list.isLoading ? (
				<div className="flex flex-col gap-2" aria-busy="true">
					<Skeleton className="h-24 w-full rounded-xl" />
					<Skeleton className="h-24 w-full rounded-xl" />
					<Skeleton className="h-24 w-full rounded-xl" />
				</div>
			) : list.isError && items.length === 0 ? (
				<EmptyState
					icon={AlertTriangleIcon}
					title="死信列表加载失败"
					description={parseApiError(list.error).message}
					size="sm"
					surface
					action={
						<Button
							variant="outline"
							size="sm"
							onClick={() => void list.refetch()}
						>
							<RotateCwIcon className="size-3.5" />
							重试
						</Button>
					}
				/>
			) : items.length === 0 ? (
				<EmptyState
					icon={CheckCircleIcon}
					title="该队列暂无死信任务"
					description="任务失败并超出重试次数后，会出现在这里。"
					size="sm"
					surface
				/>
			) : (
				<>
					<label className="flex gap-2 items-center px-1 text-[11px] text-muted-foreground">
						<input
							type="checkbox"
							className="size-3.5 accent-primary rounded-sm cursor-pointer"
							checked={allSelected}
							onChange={(event) => toggleAll(event.target.checked)}
						/>
						全选当前已加载（{items.length} 条）
					</label>

					<ul className="flex flex-col gap-2">
						{items.map((job) => (
							<DeadLetterRow
								key={job.id}
								job={job}
								selected={selectedIds.has(job.id)}
								pending={pending}
								onSelect={(next) => toggleOne(job.id, next)}
								onCopy={() => void copyJobId(job.id)}
								onRepublish={() => republishOne.mutate({ jobId: job.id })}
								onDiscard={() => removeOne.mutate({ jobId: job.id })}
							/>
						))}
					</ul>

					<div className="flex justify-center pt-1">
						{list.hasNextPage ? (
							<Button
								variant="outline"
								size="sm"
								disabled={list.isFetchingNextPage}
								onClick={() => void list.fetchNextPage()}
							>
								{list.isFetchingNextPage && (
									<Loader2Icon className="size-3.5 animate-spin" />
								)}
								加载更多
							</Button>
						) : (
							<span className="text-[11px] text-muted-foreground">
								没有更多了
							</span>
						)}
					</div>
				</>
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
						<SheetTitle className="sr-only">死信队列</SheetTitle>
						<SheetDescription className="sr-only">
							按队列查看死信任务，可重放或丢弃
						</SheetDescription>
						{header}
					</SheetHeader>
					<div className="flex-1 min-h-0 overflow-y-auto p-4">{content}</div>
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
				style={{ maxHeight: "90dvh" }}
			>
				<DrawerHeader className="gap-0 p-4 border-b border-border/60">
					<DrawerTitle className="sr-only">死信队列</DrawerTitle>
					<DrawerDescription className="sr-only">
						按队列查看死信任务，可重放或丢弃
					</DrawerDescription>
					{header}
				</DrawerHeader>
				<div className="flex-1 min-h-0 overflow-y-auto p-4">{content}</div>
			</DrawerContent>
		</Drawer>
	);
}

function DeadLetterRow({
	job,
	selected,
	pending,
	onSelect,
	onCopy,
	onRepublish,
	onDiscard,
}: {
	job: DeadLetterJobRow;
	selected: boolean;
	pending: boolean;
	onSelect: (next: boolean) => void;
	onCopy: () => void;
	onRepublish: () => void;
	onDiscard: () => void;
}) {
	const absoluteTime = new Date(job.timestamp).toLocaleString("zh-CN", {
		hour12: false,
	});

	return (
		<li
			className={cn(
				"flex gap-2.5 p-3 bg-card rounded-xl ring-1 transition-colors",
				selected ? "ring-primary/40 bg-primary/[0.03]" : "ring-border/60",
			)}
		>
			<input
				type="checkbox"
				aria-label={`选择死信任务：${job.id}`}
				className="shrink-0 mt-0.5 size-3.5 accent-primary rounded-sm cursor-pointer"
				checked={selected}
				onChange={(event) => onSelect(event.target.checked)}
			/>
			<div className="flex flex-col gap-1.5 min-w-0 flex-1">
				<div className="flex gap-2 justify-between items-center">
					<span className="text-sm font-medium truncate">
						{taskTypeLabel(job.type)}
					</span>
					<span
						className="shrink-0 text-[11px] text-muted-foreground"
						title={absoluteTime}
					>
						{formatRelativeTime(job.timestamp)}
					</span>
				</div>
				<button
					type="button"
					onClick={onCopy}
					aria-label={`复制任务 ID：${job.id}`}
					className="flex gap-1 items-center max-w-full text-[11px] text-muted-foreground rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
				>
					<span className="font-mono truncate">{job.id}</span>
					<CopyIcon className="size-3 shrink-0" />
				</button>
				{job.failedReason && (
					<p className="text-xs text-destructive break-all line-clamp-2">
						{job.failedReason}
					</p>
				)}
				<div className="flex gap-2 items-center">
					<span className="text-[11px] text-muted-foreground">
						已重试 {job.attemptsMade} 次
					</span>
					<div className="flex gap-1.5 ml-auto">
						<Button
							variant="outline"
							size="xs"
							disabled={pending}
							onClick={onRepublish}
						>
							<RefreshCwIcon className="size-3" />
							重放
						</Button>
						<Button
							variant="destructive"
							size="xs"
							disabled={pending}
							onClick={onDiscard}
						>
							<Trash2Icon className="size-3" />
							丢弃
						</Button>
					</div>
				</div>
			</div>
		</li>
	);
}
