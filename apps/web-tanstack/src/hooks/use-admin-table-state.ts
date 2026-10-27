import type { AdminTableDensity } from "@web/components/admin/data-table/data-table";
import type { AdminSort } from "@web/components/admin/data-table/types";
import { useLocalStorageState } from "@web/hooks/use-local-storage-state";
import { useCallback, useMemo, useState } from "react";

type ColumnMeta = { id: string; label: string };

type UseAdminTableStateOptions = {
	/** localStorage 命名空间，建议用资源名（comments / tasks / users…） */
	storageKey: string;
	defaultPageSize?: number;
	/** 列元数据：用于列显隐菜单（传了才启用显隐） */
	columns?: ColumnMeta[];
	/** 默认隐藏的列 id */
	defaultHidden?: string[];
};

/**
 * 后台表格的通用交互状态。
 *
 * 把「排序 / 选择 / 每页条数 / 行密度 / 列显隐」收在一处，页面只关心
 * 数据本身；其中行密度与列显隐落 localStorage（重进页面保持习惯）。
 */
export function useAdminTableState({
	storageKey,
	defaultPageSize = 20,
	columns,
	defaultHidden = [],
}: UseAdminTableStateOptions) {
	const [sort, setSort] = useState<AdminSort>(null);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(defaultPageSize);

	const [density, setDensity] = useLocalStorageState<AdminTableDensity>(
		`galzy:admin:${storageKey}:density`,
		"comfortable",
	);

	const [hiddenColumns, setHiddenColumns] = useLocalStorageState<string[]>(
		`galzy:admin:${storageKey}:hidden-columns`,
		defaultHidden,
	);

	const clearSelection = useCallback(() => {
		setSelectedIds(new Set());
	}, []);

	const visibility = useMemo(() => {
		if (!columns) return undefined;
		return {
			columns: columns.map((column) => ({
				id: column.id,
				label: column.label,
				hidden: hiddenColumns.includes(column.id),
			})),
			onToggle: (id: string, visible: boolean) => {
				setHiddenColumns((previous) =>
					visible ? previous.filter((item) => item !== id) : [...previous, id],
				);
			},
		};
	}, [columns, hiddenColumns, setHiddenColumns]);

	/**
	 * 可见列 id 集合：由「列元数据 + 本地隐藏集合」推导，
	 * 直接透给 <AdminDataTable visibleColumnIds> 即可让列菜单真正生效。
	 */
	const visibleColumnIds = useMemo(() => {
		if (!columns) return undefined;
		return new Set(
			columns
				.filter((column) => !hiddenColumns.includes(column.id))
				.map((column) => column.id),
		);
	}, [columns, hiddenColumns]);

	/** 筛选条件变化时统一回到第一页，避免停在空页上 */
	const resetToFirstPage = useCallback(() => {
		setPage(1);
		clearSelection();
	}, [clearSelection]);

	return {
		sort,
		setSort,
		selectedIds,
		setSelectedIds,
		clearSelection,
		/** clearSelection 的别名：批量操作后清空选择时语义更直白 */
		resetSelection: clearSelection,
		page,
		setPage,
		pageSize,
		setPageSize: (next: number) => {
			setPageSize(next);
			setPage(1);
		},
		density,
		setDensity,
		hiddenColumns,
		visibility,
		visibleColumnIds,
		resetToFirstPage,
	};
}
