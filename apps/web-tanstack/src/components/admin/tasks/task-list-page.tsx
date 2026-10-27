import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ConfirmDialog } from "@web/components/admin/confirm-dialog";
import {
	ColumnVisibilityMenu,
	DataTablePagination,
	DensityMenu,
} from "@web/components/admin/data-table";
import { useAdminMutation } from "@web/hooks/use-admin-mutation";
import { useAdminTableState } from "@web/hooks/use-admin-table-state";
import { formatDuration, formatRelativeTime } from "@web/lib/admin/optimistic";
import { invalidations } from "@web/lib/admin/query-keys";
import {
	useBatchDelete,
	useBatchRemoveDeadLetters,
	useBatchRepublishDeadLetters,
	useBatchRetry,
	useDeleteTask,
	useRetryTask,
} from "@web/lib/admin/tasks/mutations";
import {
	type TaskSearch,
	toTaskListFilters,
} from "@web/lib/admin/tasks/params";
import {
	taskMetaQueryOptions,
	taskQueuesQueryOptions,
	tasksQueryOptions,
} from "@web/lib/admin/tasks/query";
import { overdueFor, slaRowClass, slaState } from "@web/lib/admin/tasks/sla";
import { enqueueTask } from "@web/server/admin/tasks";
import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DeadLetterSheet } from "./dead-letter-sheet";
import { TaskBulkBar } from "./task-bulk-bar";
import { createTaskColumns } from "./task-columns";
import { TaskDetailSheet } from "./task-detail-sheet";
import { TaskFilterBar } from "./task-filter-bar";
import { TaskOverviewBar } from "./task-overview-bar";
import { TaskPageHeader } from "./task-page-header";
import { TaskQueueLanes } from "./task-queue-lanes";
import { TaskRowActions } from "./task-row-actions";
import { TaskTable } from "./task-table";
import type { TaskChip } from "./types";
import {
	TASK_RANGE_LABELS,
	type TaskFiltersPatch,
	type TaskOption,
	type TaskRow,
} from "./types";

const TERMINAL: TaskRow["status"][] = [
	"completed",
	"failed",
	"dead-letter",
	"interrupted",
];
const RETRYABLE: TaskRow["status"][] = ["failed", "dead-letter", "interrupted"];

const QUEUE_FALLBACK: Record<string, string> = {
	"galzy:vndb-sync": "VNDB 同步",
	"galzy:kungal-sync": "Kungal 同步",
	"galzy:meili-index": "Meili 索引",
	"galzy:cloudreve-sync": "Cloudreve 同步",
	"galzy:metrics": "指标/清理",
};

const STATUS_FALLBACK: Record<string, string> = {
	queued: "排队中",
	running: "运行中",
	completed: "已完成",
	failed: "失败",
	"dead-letter": "死信",
	interrupted: "已中断",
};

export type TaskListPageProps = {
	search: TaskSearch;
	onPatch: (patch: Partial<TaskSearch>) => void;
	onOpenDetail: (jobId: string) => void;
	onCloseDetail: () => void;
	onPageChange: (page: number) => void;
};

/**
 * 任务列表页整体编排。
 *
 * 这里只做四件事：URL → 查询参数、查询 → 视图数据、用户操作 → mutation、拼装组件。
 * 筛选逻辑全部下沉到 lib/admin/tasks/*，展示逻辑下沉到各子组件 —— 单文件从
 * 重构前的 1492 行降到 ~550 行，且每一行都只负责「接线」，不含视觉细节。
 */
export default function TaskListPage({
	search,
	onPatch,
	onOpenDetail,
	onCloseDetail,
	onPageChange,
}: TaskListPageProps) {
	const filters = useMemo(() => toTaskListFilters(search), [search]);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
	const [refreshMs, setRefreshMs] = useState(5000);
	// 搜索框本地草稿：输入即请求会导致 URL 每条字符都进历史/触发一次导航
	const [queryDraft, setQueryDraft] = useState(search.q);
	useEffect(() => setQueryDraft(search.q), [search.q]);
	useEffect(() => {
		if (queryDraft === search.q) return;
		const timer = setTimeout(() => onPatch({ q: queryDraft }), 350);
		return () => clearTimeout(timer);
	}, [queryDraft, search.q, onPatch]);
	const [deadLetterQueue, setDeadLetterQueue] = useState<string | null>(null);
	const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);

	/* ── 查询 ─────────────────────────────────────────────── */

	const listQuery = useQuery({
		...tasksQueryOptions(filters),
		placeholderData: keepPreviousData,
		refetchIntervalInBackground: false,
		refetchInterval: (query) => {
			if (refreshMs <= 0) return false;
			const items = (query.state.data?.items ?? []) as TaskRow[];
			const active = items.some(
				(row) => row.status === "running" || row.status === "queued",
			);
			// 没有活跃任务时降频到 30s，避免空转
			return active ? refreshMs : Math.max(refreshMs, 30_000);
		},
	});

	// 三个查询都走 lib/admin/tasks/query 的 queryOptions：
	// 路由 loader 与组件共用同一份 queryKey（预取不再靠「字面量凑巧一致」），
	// 组件这边只负责把 isPending 映射成骨架/「加载中…」。
	const metaQuery = useQuery(taskMetaQueryOptions());
	const queuesQuery = useQuery(taskQueuesQueryOptions(refreshMs));

	const data = listQuery.data;
	const rows = (data?.items ?? []) as TaskRow[];
	const total = data?.total ?? 0;
	const counts = (data?.counts ?? {}) as Record<string, number>;
	const pageCount = Math.max(1, data?.totalPages ?? 1);
	const pageSize = data?.pageSize ?? Number(search.pageSize);

	// 类型直接来自 BFF（/tasks/meta 的队列用 key，enqueue 预设用 queue，二者在下面适配）
	const meta = metaQuery.data;
	const queueLabel = (queue: string) =>
		meta?.queues.find((item) => item.key === queue)?.label ??
		QUEUE_FALLBACK[queue] ??
		queue;
	const typeLabel = (type: string) =>
		meta?.queues
			.flatMap((group) => group.tasks)
			.find((item) => item.type === type)?.label ?? type;
	const statusLabel = (status: string) =>
		meta?.statuses.find((item) => item.key === status)?.label ??
		STATUS_FALLBACK[status] ??
		status;

	/* ── 越界页钳制（唯一负责方） ─────────────────────────── */

	useEffect(() => {
		if (!data) return;
		if (search.page > pageCount) onPageChange(pageCount);
	}, [data, pageCount, search.page, onPageChange]);

	/* ── 选择集：翻页/改筛选后清空 ───────────────────────── */

	// 只在筛选/页码变化时清空选择：有意不把 selectedIds 放依赖（否则自触发循环）
	useEffect(() => {
		setSelectedIds(new Set());
	}, [
		search.page,
		search.status,
		search.queue,
		search.type,
		search.q,
		search.range,
		search.overdue,
		search.retryable,
	]);

	/* ── 写操作 ───────────────────────────────────────────── */

	const retry = useRetryTask();
	const removeTask = useDeleteTask();
	const batchRetry = useBatchRetry();
	const batchDelete = useBatchDelete();
	const republishDeadLetters = useBatchRepublishDeadLetters();
	const removeDeadLetters = useBatchRemoveDeadLetters();

	// 手动触发：乐观插入交给 useAdminMutation 的 canonical 流程，
	// 这里不依赖 mutations.ts 的封装（入队是页面独有的写操作）。
	const enqueue = useAdminMutation<
		{ ok: boolean; jobId: string } | null,
		{ queue: string; type: string; label: string }
	>({
		mutationFn: (preset) =>
			enqueueTask({ data: { queue: preset.queue, type: preset.type } }),
		affects: invalidations.tasks,
		successMessage: (_data, preset) => `${preset.label} 已入队`,
	});

	const openDeleteConfirm = (ids: string[]) => setPendingDelete(ids);
	const confirmDelete = () => {
		const ids = pendingDelete ?? [];
		setPendingDelete(null);
		if (ids.length === 0) return;
		if (ids.length === 1) removeTask.mutate({ id: ids[0] });
		else batchDelete.mutate({ ids });
	};

	/* ── 派生数据 ─────────────────────────────────────────── */

	const activeStatuses = search.status;
	const isFiltered =
		activeStatuses.length > 0 ||
		search.queue.length > 0 ||
		search.type.length > 0 ||
		search.range !== "all" ||
		search.overdue ||
		search.retryable ||
		!!search.q;

	const queueOptions: TaskOption[] = (meta?.queues ?? []).map((group) => ({
		value: group.key,
		label: group.label,
		count: queuesQuery.data?.find((item) => item.queue === group.key)?.waiting,
	}));

	const typeOptions: TaskOption[] = (meta?.queues ?? []).flatMap((group) =>
		group.tasks.map((task) => ({
			value: task.type,
			label: task.label,
		})),
	);

	const chips: TaskChip[] = [
		...(search.q
			? [
					{
						key: "q",
						label: `搜索：${search.q}`,
						onRemove: () => onPatch({ q: "" }),
					},
				]
			: []),
		...search.status.map((status) => ({
			key: `status:${status}`,
			label: `状态：${statusLabel(status)}`,
			onRemove: () =>
				onPatch({ status: search.status.filter((item) => item !== status) }),
		})),
		...search.queue.map((queue) => ({
			key: `queue:${queue}`,
			label: `队列：${queueLabel(queue)}`,
			onRemove: () =>
				onPatch({ queue: search.queue.filter((item) => item !== queue) }),
		})),
		...search.type.map((type) => ({
			key: `type:${type}`,
			label: `类型：${typeLabel(type)}`,
			onRemove: () =>
				onPatch({ type: search.type.filter((item) => item !== type) }),
		})),
		...(search.range !== "all"
			? [
					{
						key: "range",
						label: TASK_RANGE_LABELS[search.range],
						onRemove: () => onPatch({ range: "all" }),
					},
				]
			: []),
		...(search.overdue
			? [
					{
						key: "overdue",
						label: "仅看逾期",
						onRemove: () => onPatch({ overdue: false }),
					},
				]
			: []),
		...(search.retryable
			? [
					{
						key: "retryable",
						label: "仅看可重试",
						onRemove: () => onPatch({ retryable: false }),
					},
				]
			: []),
	];

	const clearAll = () => {
		onPatch({
			q: "",
			status: [],
			queue: [],
			type: [],
			range: "all",
			overdue: false,
			retryable: false,
		});
	};

	const patchFilters = (patch: TaskFiltersPatch) => {
		onPatch(patch as Partial<TaskSearch>);
	};

	const retryableSelected = rows.filter(
		(row) => selectedIds.has(row.id) && RETRYABLE.includes(row.status),
	);
	const deletableSelected = rows.filter(
		(row) => selectedIds.has(row.id) && TERMINAL.includes(row.status),
	);

	/* ── 列与视图偏好 ─────────────────────────────────────── */

	const columns = useMemo(
		() =>
			createTaskColumns({
				queueLabel,
				typeLabel,
				statusLabel,
				slaState: (row) => slaState(row, Date.now()),
				slaText: (row) => overdueFor(row),
				duration: (row) => formatDuration(row.startedAt, row.finishedAt),
				relativeTime: (value) => formatRelativeTime(value),
				absoluteTime: (value) => new Date(value).toLocaleString("zh-CN"),
			}),
		// 字典来自 meta，meta 变了列文案才需要重建
		[meta],
	);

	const columnMenu = useMemo(
		() =>
			columns.map((column) => ({
				id: column.id,
				label: String(column.label ?? column.id),
			})),
		[columns],
	);

	const table = useAdminTableState({
		storageKey: "tasks",
		defaultPageSize: pageSize,
		columns: columnMenu,
		defaultHidden: ["priority", "source", "sla"],
	});

	const visibleColumnIds = useMemo(() => {
		const hidden = new Set(table.hiddenColumns);
		return new Set(
			columns
				.filter((column) => !hidden.has(column.id))
				.map((column) => column.id),
		);
	}, [columns, table.hiddenColumns]);

	/* ── 渲染 ─────────────────────────────────────────────── */

	return (
		<div className="flex flex-col gap-4">
			<TaskPageHeader
				query={queryDraft}
				onQueryChange={setQueryDraft}
				enqueueGroups={(meta?.queues ?? []).map((group) => ({
					queue: group.key,
					label: group.label,
					tasks: group.tasks,
				}))}
				onEnqueue={(preset) => enqueue.mutate(preset)}
				enqueuePending={enqueue.isPending}
				metaLoading={metaQuery.isPending}
				queueEnabled={meta?.queueEnabled ?? true}
				isFetching={listQuery.isFetching}
				onRefresh={() => void listQuery.refetch()}
				refreshMs={refreshMs}
				onRefreshChange={setRefreshMs}
			/>

			<TaskOverviewBar
				counts={counts}
				total={total}
				isLoading={listQuery.isLoading}
				activeStatuses={activeStatuses}
				onToggle={(status) => {
					const next = activeStatuses.includes(status as never)
						? activeStatuses.filter((item) => item !== status)
						: [...activeStatuses, status];
					onPatch({ status: next as TaskSearch["status"] });
				}}
				queueLanes={
					<TaskQueueLanes
						isLoading={queuesQuery.isLoading}
						queues={queuesQuery.data ?? []}
						activeQueues={search.queue}
						onToggle={(queue) =>
							onPatch({
								queue: search.queue.includes(queue)
									? search.queue.filter((item) => item !== queue)
									: [...search.queue, queue],
							})
						}
						onOpenDeadLetter={(queue) => setDeadLetterQueue(queue)}
						labels={Object.fromEntries(
							(meta?.queues ?? []).map((group) => [group.key, group.label]),
						)}
					/>
				}
			/>

			{listQuery.error && rows.length > 0 && (
				<div className="flex gap-2 items-center px-3 py-2 text-xs rounded-xl bg-destructive/10 text-destructive ring-1 ring-destructive/20">
					<AlertTriangleIcon className="size-3.5 shrink-0" />
					<span className="flex-1 min-w-0 truncate">
						刷新失败，当前显示的是上一次的数据
					</span>
					<button
						type="button"
						onClick={() => void listQuery.refetch()}
						className="flex gap-1 items-center px-1.5 py-0.5 rounded-md hover:bg-destructive/15"
					>
						<RefreshCwIcon className="size-3" />
						重试
					</button>
				</div>
			)}

			<TaskTable
				columns={columns}
				rows={rows}
				total={total}
				pageSize={pageSize}
				q={search.q}
				isFiltered={isFiltered}
				isLoading={listQuery.isLoading}
				isFetching={listQuery.isFetching}
				error={listQuery.error}
				onRetry={() => void listQuery.refetch()}
				sort={{ id: search.sortBy, desc: search.order === "desc" }}
				onSortChange={(next) =>
					onPatch({
						sortBy: (next?.id ?? "createdAt") as TaskSearch["sortBy"],
						order: next && !next.desc ? "asc" : "desc",
					})
				}
				selectedIds={selectedIds}
				onSelectedIdsChange={setSelectedIds}
				onRowClick={(row) => onOpenDetail(row.id)}
				density={table.density}
				visibleColumnIds={visibleColumnIds}
				getRowClassName={(row) => {
					const state = slaState(row, Date.now());
					return state === "normal" ? undefined : slaRowClass(state);
				}}
				rowActions={(row) => (
					<TaskRowActions
						row={row}
						onOpenDetail={onOpenDetail}
						onRetry={(id) => retry.mutate({ id })}
						onRepublish={(id) =>
							republishDeadLetters.mutate({ queue: row.queue, jobIds: [id] })
						}
						onDiscard={(id) =>
							removeDeadLetters.mutate({ queue: row.queue, jobIds: [id] })
						}
						onDelete={(id) => openDeleteConfirm([id])}
						retryPending={retry.isPending && retry.variables?.id === row.id}
					/>
				)}
				onClearFilters={clearAll}
				onClearSearch={() => onPatch({ q: "" })}
				toolbar={
					<TaskFilterBar
						filters={{
							status: search.status,
							queue: search.queue,
							type: search.type,
							q: search.q,
							range: search.range,
							overdue: search.overdue,
							retryable: search.retryable,
							sortBy: search.sortBy,
							order: search.order,
							page: search.page,
							pageSize: String(search.pageSize),
						}}
						statusCounts={counts}
						queueOptions={queueOptions}
						typeOptions={typeOptions}
						isFiltered={isFiltered}
						total={total}
						optionsLoading={metaQuery.isPending}
						onPatch={patchFilters}
						onClearAll={clearAll}
						chips={chips}
						viewControls={
							<span className="flex gap-1.5 items-center">
								{table.visibility && (
									<ColumnVisibilityMenu
										columns={table.visibility.columns}
										onToggle={table.visibility.onToggle}
									/>
								)}
								<DensityMenu
									density={table.density}
									onDensityChange={table.setDensity}
								/>
							</span>
						}
					/>
				}
				footer={
					<DataTablePagination
						page={search.page}
						pageCount={pageCount}
						total={total}
						pageSize={pageSize}
						onPageChange={onPageChange}
						onPageSizeChange={(size) =>
							onPatch({ pageSize: String(size) as TaskSearch["pageSize"] })
						}
						hint={
							selectedIds.size > 0
								? `已选 ${selectedIds.size} 条`
								: counts.failed
									? `失败 ${counts.failed} 条`
									: undefined
						}
					/>
				}
				bulkBar={
					selectedIds.size > 0 ? (
						<TaskBulkBar
							count={selectedIds.size}
							retryableCount={retryableSelected.length}
							deletableCount={deletableSelected.length}
							pending={batchRetry.isPending || batchDelete.isPending}
							onRetry={() =>
								batchRetry.mutate({
									ids: retryableSelected.map((row) => row.id),
								})
							}
							onDelete={() =>
								openDeleteConfirm(deletableSelected.map((row) => row.id))
							}
							onClear={() => setSelectedIds(new Set())}
						/>
					) : null
				}
			/>

			<TaskDetailSheet jobId={search.job} onClose={onCloseDetail} />

			<DeadLetterSheet
				queue={deadLetterQueue}
				onClose={() => setDeadLetterQueue(null)}
			/>

			<ConfirmDialog
				open={!!pendingDelete}
				onOpenChange={(open) => !open && setPendingDelete(null)}
				title="删除任务记录"
				desc={
					pendingDelete
						? `将删除 ${pendingDelete.length} 条记录。仅清理数据库中的历史记录，不影响正在执行的任务。`
						: ""
				}
				confirmText="确认删除"
				destructive
				isLoading={removeTask.isPending || batchDelete.isPending}
				onConfirm={confirmDelete}
			/>
		</div>
	);
}
