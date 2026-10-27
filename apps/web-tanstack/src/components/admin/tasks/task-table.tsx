import type { AdminColumn } from "@web/components/admin/data-table";
import {
	AdminDataTable,
	type AdminSort,
} from "@web/components/admin/data-table";
import { Button } from "@web/components/ui/button";
import {
	FilterXIcon,
	ListTodoIcon,
	SearchXIcon,
	ServerCrashIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { TaskRow } from "./types";

export type TaskTableProps = {
	columns: AdminColumn<TaskRow>[];
	rows: TaskRow[];
	total: number;
	pageSize: number;
	q: string;
	isFiltered: boolean;
	isLoading: boolean;
	isFetching: boolean;
	error: unknown;
	onRetry: () => void;
	sort: AdminSort;
	onSortChange: (sort: AdminSort) => void;
	selectedIds: ReadonlySet<string>;
	onSelectedIdsChange: (next: Set<string>) => void;
	onRowClick: (row: TaskRow) => void;
	density?: "comfortable" | "compact";
	visibleColumnIds?: ReadonlySet<string>;
	getRowClassName?: (row: TaskRow) => string | undefined;
	rowActions: (row: TaskRow) => ReactNode;
	toolbar?: ReactNode;
	footer?: ReactNode;
	bulkBar?: ReactNode;
	/** 无数据空态里的主操作（手动触发） */
	enqueueAction?: ReactNode;
	filterSummary?: ReactNode;
	onClearFilters: () => void;
	onClearSearch: () => void;
};

function errorMessageOf(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return "请稍后重试，或查看服务端日志";
}

/**
 * 错误态：整块卡片 + 重试，与「没有数据」严格区分（现状 B2 的反面）。
 *
 * 工具条（筛选条）必须保留：接口挂了的时候用户更需要「换个筛选试试」，
 * 而不是把筛选控件一起藏起来。所以这里自己画卡片外壳，而不是交给 AdminDataTable。
 */
function TaskTableError({
	error,
	onRetry,
	toolbar,
}: {
	error: unknown;
	onRetry: () => void;
	toolbar?: ReactNode;
}) {
	return (
		<div className="flex overflow-hidden flex-col bg-card rounded-2xl ring-1 ring-border/60">
			{toolbar}
			<div className="flex flex-col justify-center items-center py-14 px-6 text-center">
				<div className="grid mb-3 place-items-center rounded-2xl size-12 bg-destructive/10 text-destructive">
					<ServerCrashIcon className="size-5" />
				</div>
				<p className="text-sm font-medium">任务列表加载失败</p>
				<p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground break-all">
					{errorMessageOf(error)}
				</p>
				<Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
					重新加载
				</Button>
			</div>
		</div>
	);
}

/**
 * 列表三态：
 * - 有错误且没有任何数据 → 错误态（不是空态）；
 * - 有错误但有旧数据 → 交给表格的 isFetching 压暗 + 顶部条（由 list-page 渲染）；
 * - 空 → 四个分支：搜索无结果 / 筛选无结果 / 真无数据 / 其它。
 */
export function TaskTable({
	columns,
	rows,
	pageSize,
	q,
	isFiltered,
	isLoading,
	isFetching,
	error,
	onRetry,
	sort,
	onSortChange,
	selectedIds,
	onSelectedIdsChange,
	onRowClick,
	density = "comfortable",
	visibleColumnIds,
	getRowClassName,
	rowActions,
	toolbar,
	footer,
	bulkBar,
	enqueueAction,
	filterSummary,
	onClearFilters,
	onClearSearch,
}: TaskTableProps) {
	if (error && rows.length === 0) {
		return <TaskTableError error={error} onRetry={onRetry} toolbar={toolbar} />;
	}

	const empty = q
		? {
				icon: SearchXIcon,
				title: `没有匹配「${q}」的任务`,
				description: "搜索覆盖任务 ID、类型与错误文本，试试更短的关键词",
				action: (
					<Button variant="outline" size="sm" onClick={onClearSearch}>
						清空搜索
					</Button>
				),
			}
		: isFiltered
			? {
					icon: FilterXIcon,
					title: "没有符合当前条件的任务",
					description: filterSummary ?? "当前筛选条件下没有记录",
					action: (
						<Button size="sm" onClick={onClearFilters}>
							清除全部筛选
						</Button>
					),
				}
			: {
					icon: ListTodoIcon,
					title: "还没有任务记录",
					description: "手动触发一个同步任务，或等待定时调度执行",
					action: enqueueAction,
				};

	return (
		<AdminDataTable<TaskRow>
			columns={columns}
			rows={rows}
			getRowId={(row) => row.id}
			isLoading={isLoading}
			isFetching={isFetching}
			skeletonRows={Math.min(pageSize, 12)}
			empty={empty}
			sort={sort}
			onSortChange={onSortChange}
			selectedIds={selectedIds}
			onSelectedIdsChange={onSelectedIdsChange}
			onRowClick={onRowClick}
			rowActions={rowActions}
			density={density}
			visibleColumnIds={visibleColumnIds}
			getRowClassName={getRowClassName}
			error={error}
			onRetry={onRetry}
			toolbar={toolbar}
			footer={footer}
			bulkBar={bulkBar}
			minWidth="min-w-[860px]"
		/>
	);
}

/** 供「筛选无结果」空态复用的条件摘要。 */
export function FilterSummary({ items }: { items: string[] }) {
	if (items.length === 0) return null;
	return (
		<span className="flex flex-wrap gap-1 justify-center items-center">
			{items.map((item) => (
				<span
					key={item}
					className="px-1.5 py-0.5 text-[11px] bg-muted rounded-md"
				>
					{item}
				</span>
			))}
		</span>
	);
}
