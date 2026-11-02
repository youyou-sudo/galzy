import { DataTableBulkActions } from "@web/components/admin/data-table";
import { Button } from "@web/components/ui/button";
import { Spinner } from "@web/components/ui/spinner";
import { cn } from "@web/lib/utils";
import { DownloadIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";

export type TaskBulkBarProps = {
	/** 选中的行数（0 时容器自己不渲染） */
	count: number;
	/** 选中里处于可重试状态的数量 */
	retryableCount: number;
	/** 选中里处于终态、可删除记录的数量 */
	deletableCount: number;
	/** 任一批量操作进行中 */
	pending: boolean;
	onRetry: () => void;
	onDelete: () => void;
	/** 取消选择 */
	onClear: () => void;
	/** 导出选中（不传则不渲染导出按钮） */
	onExport?: () => void;
	className?: string;
};

/** 禁用原因：有值时按钮 disabled 并把原因写进 title。 */
function disabledReason(pending: boolean, available: number, reason: string) {
	if (pending) return "操作进行中，请稍候";
	if (available === 0) return reason;
	return undefined;
}

/**
 * 批量操作条：重试 / 删除 / 导出。
 *
 * 容器（DataTableBulkActions）负责 fixed 浮出与「已选 N 项」，
 * 这里只关心按钮可用性：不可用时禁用 + title 说明原因，
 * 不为用户保留一个点了没反应的按钮。禁用按钮默认 pointer-events-none，
 * 会让 title 失效，所以带原因时补一个 disabled:pointer-events-auto。
 */
export function TaskBulkBar({
	count,
	retryableCount,
	deletableCount,
	pending,
	onRetry,
	onDelete,
	onClear,
	onExport,
	className,
}: TaskBulkBarProps) {
	const retryReason = disabledReason(
		pending,
		retryableCount,
		"选中的任务都不在可重试状态（失败 / 已中断 / 死信）",
	);
	const deleteReason = disabledReason(
		pending,
		deletableCount,
		"选中的任务都不是终态，无法删除",
	);

	return (
		<DataTableBulkActions count={count} onClear={onClear} className={className}>
			<Button
				variant="outline"
				size="sm"
				onClick={onRetry}
				disabled={retryReason !== undefined}
				title={retryReason}
				className={cn("gap-1", retryReason && "disabled:pointer-events-auto")}
			>
				{pending ? (
					<Spinner className="size-3.5" />
				) : (
					<RotateCcwIcon className="size-3.5" />
				)}
				重试
				{retryableCount > 0 && (
					<span className="tabular-nums text-muted-foreground">
						{retryableCount}
					</span>
				)}
			</Button>

			<Button
				variant="destructive"
				size="sm"
				onClick={onDelete}
				disabled={deleteReason !== undefined}
				title={deleteReason}
				className={cn("gap-1", deleteReason && "disabled:pointer-events-auto")}
			>
				<Trash2Icon className="size-3.5" />
				删除记录
				{deletableCount > 0 && (
					<span className="tabular-nums opacity-70">{deletableCount}</span>
				)}
			</Button>

			{onExport && (
				<Button
					variant="outline"
					size="sm"
					onClick={onExport}
					disabled={pending}
					title={pending ? "操作进行中，请稍候" : "导出选中任务为 CSV"}
					className={cn("gap-1", pending && "disabled:pointer-events-auto")}
				>
					<DownloadIcon className="size-3.5" />
					导出
				</Button>
			)}
		</DataTableBulkActions>
	);
}
