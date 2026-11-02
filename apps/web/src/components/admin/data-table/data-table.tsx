import { EmptyState } from "@web/components/shared/empty-state";
import { Button } from "@web/components/ui/button";
import { Skeleton } from "@web/components/ui/skeleton";
import { cn } from "@web/lib/utils";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	ChevronsUpDownIcon,
	CircleAlertIcon,
	RefreshCwIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import type { AdminColumn, AdminSort, AdminTableEmpty } from "./types";

/** 行高密度：comfortable 为默认（对齐 List 阅读节奏），compact 供运维盯屏。 */
export type AdminTableDensity = "comfortable" | "compact";

const densityCell: Record<AdminTableDensity, string> = {
	comfortable: "py-3",
	compact: "py-1.5",
};

const hideBelowClass = {
	sm: "hidden sm:table-cell",
	md: "hidden md:table-cell",
	lg: "hidden lg:table-cell",
	xl: "hidden xl:table-cell",
} as const;

function alignClass(align: "left" | "right" | "center" | undefined) {
	if (align === "right") return "text-right";
	if (align === "center") return "text-center";
	return "text-left";
}

/**
 * 把 unknown 错误归一化成一行可读文案；取不到就返回 undefined，由调用方兜底。
 * 服务端抛出的错误可能是 Error / string / { message } 三种形态。
 */
function errorMessageOf(error: unknown): string | undefined {
	if (!error) return undefined;
	if (typeof error === "string") return error || undefined;
	if (error instanceof Error) return error.message || undefined;
	if (typeof error === "object" && "message" in error) {
		const message = (error as { message?: unknown }).message;
		return typeof message === "string" && message ? message : undefined;
	}
	return undefined;
}

/** 表头 aria-sort：只有可排序列带语义，非当前排序列为 none。 */
function ariaSortOf<T>(column: AdminColumn<T>, sort: AdminSort | undefined) {
	if (!column.sortable) return undefined;
	if (sort?.id !== column.id) return "none" as const;
	return sort.desc ? ("descending" as const) : ("ascending" as const);
}

/**
 * 表头排序按钮。
 * 只有 sortable 的列才渲染成 button：整列可点，命中面积大于一个小箭头。
 */
export function SortHeader({
	column,
	sort,
	onSortChange,
	className,
}: {
	column: AdminColumn<unknown>;
	sort: AdminSort | undefined;
	onSortChange?: (sort: AdminSort) => void;
	className?: string;
}) {
	const active = sort?.id === column.id;
	const desc = active ? !!sort?.desc : false;

	if (!column.sortable || !onSortChange) {
		return (
			<span className={cn("inline-flex", className)}>{column.header}</span>
		);
	}

	const next = (): AdminSort => {
		// 三态循环：升序 → 降序 → 取消
		if (!active) return { id: column.id, desc: false };
		if (!desc) return { id: column.id, desc: true };
		return null;
	};

	const Icon = active
		? desc
			? ArrowDownIcon
			: ArrowUpIcon
		: ChevronsUpDownIcon;

	return (
		<button
			type="button"
			onClick={() => onSortChange(next())}
			aria-label={`按 ${typeof column.header === "string" ? column.header : column.id} 排序`}
			className={cn(
				"-mx-1 inline-flex gap-1 items-center px-1 py-0.5 rounded-md transition-colors",
				active ? "text-foreground" : "hover:text-foreground",
				className,
			)}
		>
			{column.header}
			<Icon
				className={cn(
					"size-3 shrink-0 transition-opacity",
					active ? "opacity-100" : "opacity-40",
				)}
			/>
		</button>
	);
}

/** 原生 checkbox：base-nova 未内置 checkbox 组件，原生实现能保证键盘/读屏语义。 */
export function SelectionCheckbox({
	checked,
	indeterminate = false,
	label,
	onChange,
}: {
	checked: boolean;
	indeterminate?: boolean;
	label: string;
	onChange: (next: boolean) => void;
}) {
	const ref = useRef<HTMLInputElement>(null);
	useEffect(() => {
		if (ref.current) ref.current.indeterminate = indeterminate;
	}, [indeterminate]);
	return (
		<input
			ref={ref}
			type="checkbox"
			aria-label={label}
			checked={checked}
			onClick={(event) => event.stopPropagation()}
			onChange={(event) => onChange(event.target.checked)}
			className="size-3.5 align-middle accent-primary rounded-sm cursor-pointer"
		/>
	);
}

export type AdminDataTableProps<T> = {
	columns: AdminColumn<T>[];
	rows: T[];
	getRowId: (row: T) => string;
	/** 首屏加载：渲染骨架行，保持表头结构稳定 */
	isLoading?: boolean;
	/** 后台刷新：保留行，仅轻微压暗，不闪屏 */
	isFetching?: boolean;
	skeletonRows?: number;
	empty: AdminTableEmpty;
	/**
	 * 有值时按该集合过滤列（优先级高于 defaultHidden）。
	 * 由 useAdminTableState 的 visibleColumnIds 驱动列显隐菜单。
	 */
	visibleColumnIds?: ReadonlySet<string>;
	/**
	 * 数据加载失败。仅在 rows 为空时渲染错误态；rows 非空视为保留旧数据，忽略。
	 */
	error?: unknown;
	/** 错误态的重试回调；不传则不渲染「重试」按钮 */
	onRetry?: () => void;
	/** 错误态标题，默认「加载失败」 */
	errorTitle?: ReactNode;
	/** 排序受控 */
	sort?: AdminSort;
	onSortChange?: (sort: AdminSort) => void;
	/** 行选择受控（传入即开启多选） */
	selectedIds?: ReadonlySet<string>;
	onSelectedIdsChange?: (next: Set<string>) => void;
	/** 行级附加类名（如「已禁用」行的整行降饱和） */
	getRowClassName?: (row: T) => string | undefined;
	/** 点击整行（详情 / 编辑） */
	onRowClick?: (row: T) => void;
	/** 右侧固定操作列 */
	rowActions?: (row: T) => ReactNode;
	actionsHeader?: ReactNode;
	minWidth?: string;
	density?: AdminTableDensity;
	/** 表头上方的工具条 */
	toolbar?: ReactNode;
	/** 表格下方的分页脚 */
	footer?: ReactNode;
	/** 选中后浮出的批量操作条 */
	bulkBar?: ReactNode;
	className?: string;
	/** 移动端直接用手写卡片渲染（结构复杂的页面用） */
	renderMobileCard?: (row: T) => ReactNode;
};

/**
 * 后台统一数据表。
 *
 * 设计契约（对齐 new-api 的 data-table 视觉语言）：
 * - 容器 round-2xl + ring-1 ring-border/60，不再用 border；
 * - 表头 sticky + --table-header 底色，横滚时表头不动；
 * - 行 hover 用 muted/40，选中行用 primary/5 + 左侧 2px 主色条；
 * - 操作列右固定，横滚时仍然可点；
 * - 窄屏（< sm）自动切换为卡片列表，而不是让用户横向拖表格。
 */
export function AdminDataTable<T>({
	columns,
	rows,
	getRowId,
	isLoading = false,
	isFetching = false,
	skeletonRows = 8,
	empty,
	visibleColumnIds,
	error,
	onRetry,
	errorTitle,
	sort,
	onSortChange,
	selectedIds,
	onSelectedIdsChange,
	getRowClassName,
	onRowClick,
	rowActions,
	actionsHeader,
	minWidth = "min-w-[720px]",
	density = "comfortable",
	toolbar,
	footer,
	bulkBar,
	className,
	renderMobileCard,
}: AdminDataTableProps<T>) {
	const selectable = !!selectedIds && !!onSelectedIdsChange;
	// 列显隐：外部给了集合就以它为准（列菜单可显示默认隐藏列），
	// 否则退回「列定义里的 defaultHidden」，保持既有页面行为不变。
	const visibleColumns = visibleColumnIds
		? columns.filter((column) => visibleColumnIds.has(column.id))
		: columns.filter((column) => !column.defaultHidden);
	const allIds = rows.map(getRowId);
	const selectedOnPage = allIds.filter((id) => selectedIds?.has(id));
	const allSelected =
		allIds.length > 0 && selectedOnPage.length === allIds.length;
	const someSelected = selectedOnPage.length > 0 && !allSelected;

	const toggleAll = (next: boolean) => {
		if (!onSelectedIdsChange) return;
		const draft = new Set(selectedIds ?? []);
		for (const id of allIds) {
			if (next) draft.add(id);
			else draft.delete(id);
		}
		onSelectedIdsChange(draft);
	};

	const toggleOne = (id: string, next: boolean) => {
		if (!onSelectedIdsChange) return;
		const draft = new Set(selectedIds ?? []);
		if (next) draft.add(id);
		else draft.delete(id);
		onSelectedIdsChange(draft);
	};

	const cellPad = densityCell[density];
	const showSkeleton = isLoading && rows.length === 0;
	// 首屏加载优先于错误态：重试时先出骨架，避免错误卡片闪一下；
	// rows 非空说明是后台刷新失败，保留旧数据而不是整表换错误态。
	const showError = !!error && rows.length === 0 && !isLoading;
	const columnCount =
		visibleColumns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);

	const errorState = (
		<EmptyState
			icon={CircleAlertIcon}
			title={errorTitle ?? "加载失败"}
			description={errorMessageOf(error) ?? "请求数据时出错，请稍后重试。"}
			action={
				onRetry ? (
					<Button variant="outline" size="sm" onClick={onRetry}>
						<RefreshCwIcon className="size-3.5" />
						重试
					</Button>
				) : undefined
			}
			size="sm"
		/>
	);

	return (
		<div
			className={cn(
				"flex overflow-hidden flex-col bg-card rounded-2xl ring-1 ring-border/60",
				className,
			)}
		>
			{toolbar}

			{/* ── 桌面表格 ─────────────────────────────────────── */}
			<div className="hidden overflow-x-auto w-full sm:block">
				<table
					className={cn(
						"w-full text-sm border-separate border-spacing-0",
						minWidth,
					)}
					aria-busy={isLoading || isFetching}
				>
					<thead className="bg-[color:var(--table-header)]">
						<tr>
							{selectable && (
								<th
									scope="col"
									className="sticky top-0 z-10 px-3 w-9 text-left border-b border-border/60"
								>
									<SelectionCheckbox
										checked={allSelected}
										indeterminate={someSelected}
										label="全选当前页"
										onChange={toggleAll}
									/>
								</th>
							)}
							{visibleColumns.map((column) => (
								<th
									key={column.id}
									scope="col"
									aria-sort={ariaSortOf(column, sort)}
									className={cn(
										"sticky top-0 z-10 px-4 py-2.5 text-xs font-medium whitespace-nowrap text-muted-foreground border-b border-border/60",
										alignClass(column.align),
										column.hideBelow && hideBelowClass[column.hideBelow],
										column.headerClassName,
									)}
								>
									<SortHeader
										column={column as AdminColumn<unknown>}
										sort={sort}
										onSortChange={onSortChange}
									/>
								</th>
							))}
							{rowActions && (
								<th
									scope="col"
									className="sticky top-0 right-0 z-20 px-4 py-2.5 w-px text-xs font-medium text-right whitespace-nowrap bg-[color:var(--table-header)] text-muted-foreground border-b border-border/60"
								>
									<span className="sr-only">{actionsHeader ?? "操作"}</span>
								</th>
							)}
						</tr>
					</thead>

					<tbody
						className={cn(
							"transition-opacity duration-200",
							isFetching && !isLoading && "opacity-60",
						)}
					>
						{showSkeleton ? (
							Array.from({ length: skeletonRows }).map((_, rowIndex) => (
								<tr
									// biome-ignore lint/suspicious/noArrayIndexKey: 骨架行无稳定 id
									key={rowIndex}
									className="border-b border-border/60"
								>
									{selectable && <td className="px-3 py-3" />}
									{visibleColumns.map((column, cellIndex) => (
										<td key={column.id} className={cn("px-4", cellPad)}>
											<Skeleton
												className={cn("h-4", cellIndex === 0 ? "w-32" : "w-20")}
											/>
										</td>
									))}
									{rowActions && <td className={cn("px-4", cellPad)} />}
								</tr>
							))
						) : showError ? (
							<tr>
								<td colSpan={columnCount} className="p-0">
									{errorState}
								</td>
							</tr>
						) : rows.length === 0 ? (
							<tr>
								<td colSpan={columnCount} className="p-0">
									<EmptyState
										icon={empty.icon}
										title={empty.title}
										description={empty.description}
										action={empty.action}
										size="sm"
									/>
								</td>
							</tr>
						) : (
							rows.map((row) => {
								const id = getRowId(row);
								const selected = selectedIds?.has(id) ?? false;
								const clickable = !!onRowClick;
								return (
									<tr
										key={id}
										data-state={selected ? "selected" : undefined}
										onClick={clickable ? () => onRowClick(row) : undefined}
										className={cn(
											"group/row border-b border-border/60 transition-colors duration-150 last:border-b-0",
											"hover:bg-muted/40",
											selected && "bg-primary/[0.04] hover:bg-primary/[0.07]",
											clickable && "cursor-pointer",
											getRowClassName?.(row),
										)}
									>
										{selectable && (
											<td className="relative px-3 align-middle">
												{selected && (
													<span className="absolute inset-y-0 left-0 w-0.5 bg-primary" />
												)}
												<SelectionCheckbox
													checked={selected}
													label="选择此行"
													onChange={(next) => toggleOne(id, next)}
												/>
											</td>
										)}
										{visibleColumns.map((column) => (
											<td
												key={column.id}
												className={cn(
													"px-4 align-middle",
													cellPad,
													alignClass(column.align),
													column.hideBelow && hideBelowClass[column.hideBelow],
													column.className,
												)}
											>
												{column.cell(row)}
											</td>
										))}
										{rowActions && (
											<td
												className={cn(
													"sticky right-0 z-10 px-4 align-middle bg-card group-hover/row:bg-muted",
													selected &&
														"bg-[color-mix(in_oklab,var(--primary)_4%,var(--card))]",
													cellPad,
												)}
												onClick={(event) => event.stopPropagation()}
											>
												<div className="flex gap-1 justify-end items-center">
													{rowActions(row)}
												</div>
											</td>
										)}
									</tr>
								);
							})
						)}
					</tbody>
				</table>
			</div>

			{/* ── 移动端卡片列表 ───────────────────────────────── */}
			<ul className="flex flex-col divide-y divide-border/60 sm:hidden">
				{showSkeleton ? (
					Array.from({ length: 5 }).map((_, index) => (
						<li
							// biome-ignore lint/suspicious/noArrayIndexKey: 骨架卡片无稳定 id
							key={index}
							className="flex flex-col gap-2 p-4"
						>
							<Skeleton className="w-2/3 h-4" />
							<Skeleton className="w-1/3 h-3" />
						</li>
					))
				) : showError ? (
					<li>{errorState}</li>
				) : rows.length === 0 ? (
					<li>
						<EmptyState
							icon={empty.icon}
							title={empty.title}
							description={empty.description}
							action={empty.action}
							size="sm"
						/>
					</li>
				) : (
					rows.map((row) => {
						const id = getRowId(row);
						const selected = selectedIds?.has(id) ?? false;
						if (renderMobileCard) {
							return (
								<li key={id} className={cn(selected && "bg-primary/[0.04]")}>
									{renderMobileCard(row)}
								</li>
							);
						}
						const titleColumns = visibleColumns.filter(
							(column) => column.mobile === "title",
						);
						const metaColumns = visibleColumns.filter(
							(column) => column.mobile === "meta",
						);
						const bodyColumns = visibleColumns.filter(
							(column) => column.mobile === "body",
						);
						return (
							<li
								key={id}
								className={cn("p-4", selected && "bg-primary/[0.04]")}
								onClick={onRowClick ? () => onRowClick(row) : undefined}
							>
								<div className="flex gap-3 justify-between items-start">
									<div className="flex flex-col flex-1 gap-1 min-w-0">
										<div className="flex flex-wrap gap-x-2 gap-y-1 items-center min-w-0">
											{selectable && (
												<SelectionCheckbox
													checked={selected}
													label="选择此行"
													onChange={(next) => toggleOne(id, next)}
												/>
											)}
											{titleColumns.map((column) => (
												<span key={column.id} className="min-w-0">
													{(column.mobileCell ?? column.cell)(row)}
												</span>
											))}
										</div>
										{metaColumns.length > 0 && (
											<div className="flex flex-wrap gap-x-3 gap-y-1 items-center text-xs text-muted-foreground">
												{metaColumns.map((column) => (
													<span key={column.id}>
														{(column.mobileCell ?? column.cell)(row)}
													</span>
												))}
											</div>
										)}
										{bodyColumns.map((column) => (
											<div key={column.id} className="min-w-0">
												{(column.mobileCell ?? column.cell)(row)}
											</div>
										))}
									</div>
									{rowActions && (
										<div
											className="flex shrink-0 gap-1 items-center"
											onClick={(event) => event.stopPropagation()}
										>
											{rowActions(row)}
										</div>
									)}
								</div>
							</li>
						);
					})
				)}
			</ul>

			{footer}
			{bulkBar}
		</div>
	);
}
