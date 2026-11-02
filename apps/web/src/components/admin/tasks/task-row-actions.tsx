import {
	type AdminRowAction,
	RowActionsMenu,
} from "@web/components/admin/data-table";
import { Button } from "@web/components/ui/button";
import { Spinner } from "@web/components/ui/spinner";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@web/components/ui/tooltip";
import {
	BracesIcon,
	CopyIcon,
	RefreshCwIcon,
	RotateCcwIcon,
	ScrollTextIcon,
	Trash2Icon,
	XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { TaskRow } from "./types";

export type TaskRowActionsProps = {
	row: TaskRow;
	onOpenDetail: (id: string) => void;
	onRetry: (id: string) => void;
	onRepublish: (id: string) => void;
	onDiscard: (id: string) => void;
	onDelete: (id: string) => void;
	retryPending?: boolean;
};

const RETRYABLE: TaskRow["status"][] = ["failed", "dead-letter", "interrupted"];
const TERMINAL: TaskRow["status"][] = [
	"completed",
	"failed",
	"dead-letter",
	"interrupted",
];

function canRetry(row: TaskRow) {
	return RETRYABLE.includes(row.status);
}

/** 终态才允许删记录（与后端 deleteJob 的门控一致）。 */
function deleteDisabledReason(row: TaskRow): string | undefined {
	if (TERMINAL.includes(row.status)) return undefined;
	return "运行中/排队中的任务不可删除，请等待结束";
}

async function copyText(value: string) {
	try {
		await navigator.clipboard.writeText(value);
		toast.success("已复制到剪贴板");
	} catch {
		toast.error("复制失败，请手动选择文本");
	}
}

/**
 * 行内操作：高频外露（查看日志 + 条件性重试），其余收进 ⋯。
 *
 * 重构前 6 个操作全塞进 ⋯，最常用的「查看日志」要点两层菜单，
 * 这是这次重构要修的第一条交互问题。
 */
export function TaskRowActions({
	row,
	onOpenDetail,
	onRetry,
	onRepublish,
	onDiscard,
	onDelete,
	retryPending = false,
}: TaskRowActionsProps) {
	const actions: AdminRowAction[] = [
		{
			label: "复制任务 ID",
			icon: CopyIcon,
			onSelect: () => void copyText(row.id),
		},
		{
			label: "查看载荷",
			icon: BracesIcon,
			onSelect: () => onOpenDetail(row.id),
		},
		{
			label: "重放回队列",
			icon: RefreshCwIcon,
			hidden: row.status !== "dead-letter",
			onSelect: () => onRepublish(row.id),
		},
		{
			label: "丢弃死信",
			icon: XCircleIcon,
			variant: "destructive",
			hidden: row.status !== "dead-letter",
			onSelect: () => onDiscard(row.id),
		},
		{
			label: "删除记录",
			icon: Trash2Icon,
			variant: "destructive",
			separator: true,
			disabledReason: deleteDisabledReason(row),
			onSelect: () => onDelete(row.id),
		},
	];

	return (
		<div className="flex gap-1 justify-end items-center">
			<Tooltip>
				<TooltipTrigger
					render={
						<Button variant="ghost" size="icon-sm" aria-label="查看日志" />
					}
					onClick={() => onOpenDetail(row.id)}
				>
					<ScrollTextIcon className="size-4" />
				</TooltipTrigger>
				<TooltipContent>查看日志</TooltipContent>
			</Tooltip>

			{canRetry(row) && (
				<Tooltip>
					<TooltipTrigger
						render={
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="重试"
								disabled={retryPending}
								onClick={() => onRetry(row.id)}
							/>
						}
					>
						{retryPending ? (
							<Spinner className="size-4" />
						) : (
							<RotateCcwIcon className="size-4" />
						)}
					</TooltipTrigger>
					<TooltipContent>重试</TooltipContent>
				</Tooltip>
			)}

			<RowActionsMenu actions={actions} label="更多操作" />
		</div>
	);
}
