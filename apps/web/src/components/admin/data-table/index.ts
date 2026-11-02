/**
 * 后台数据表套件（对齐 new-api 的 data-table 交互与视觉）。
 *
 * 典型用法：
 *
 * const columns: AdminColumn<AdminComment>[] = [
 *   { id: "user", header: "用户", cell: (row) => <AdminUserTooltip user={row.user} />, mobile: "title" },
 *   { id: "content", header: "内容", cell: (row) => row.content, className: "max-w-xs truncate" },
 *   { id: "status", header: "状态", cell: (row) => <StatusPill ... />, mobile: "meta" },
 * ];
 *
 * <AdminDataTable
 *   columns={columns}
 *   rows={comments}
 *   getRowId={(row) => row.id}
 *   isLoading={isLoading}
 *   isFetching={isFetching}
 *   empty={{ icon: MessageSquareIcon, title: "暂无评论数据" }}
 *   toolbar={<DataTableToolbar search={...} filters={[...]} actions={...} />}
 *   footer={<DataTablePagination ... />}
 *   rowActions={(row) => <RowActionsMenu actions={[...]} />}
 * />
 */

export { DataTableBulkActions } from "./bulk-actions";
export type {
	AdminDataTableProps,
	AdminTableDensity,
} from "./data-table";
export { AdminDataTable, SelectionCheckbox, SortHeader } from "./data-table";
export type { DataTablePaginationProps } from "./pagination";
export { DataTablePagination } from "./pagination";
export { RowActionsMenu } from "./row-actions";
export type {
	AdminFilter,
	AdminFilterOption,
	ColumnVisibilityControls,
	DataTableToolbarProps,
} from "./toolbar";
export {
	ColumnVisibilityMenu,
	DataTableToolbar,
	DensityMenu,
} from "./toolbar";
export type {
	AdminColumn,
	AdminRowAction,
	AdminSort,
	AdminTableEmpty,
} from "./types";
