import { Button } from "@web/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@web/components/ui/select";
import { cn } from "@web/lib/utils";
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	ChevronsLeftIcon,
	ChevronsRightIcon,
} from "lucide-react";

const DEFAULT_PAGE_SIZES = [10, 20, 50, 100];

/**
 * 页码夹取：0 / 负数 / NaN / 越界都归到 1..totalPages。
 * 数据被筛短或 URL 里带着旧页码时，渲染出一个不存在的页会闪空表。
 */
function clampPage(page: number, totalPages: number): number {
	const max = Math.max(
		1,
		Math.trunc(Number.isFinite(totalPages) ? totalPages : 1),
	);
	const raw = Number.isFinite(page) ? Math.trunc(page) : 1;
	return Math.min(Math.max(raw, 1), max);
}

/** 紧凑页码：[1, …, 4, 5, 6, …, 12]；入参越界时同样先夹取，避免出现 0 与重复页码。 */
function pageRange(current: number, total: number): (number | "…")[] {
	if (total <= 0) return [];
	const safeCurrent = clampPage(current, total);
	if (total <= 6) return Array.from({ length: total }, (_, index) => index + 1);
	if (safeCurrent <= 3) return [1, 2, 3, 4, "…", total];
	if (safeCurrent >= total - 2)
		return [1, "…", total - 3, total - 2, total - 1, total];
	return [1, "…", safeCurrent - 1, safeCurrent, safeCurrent + 1, "…", total];
}

export type DataTablePaginationProps = {
	/** 当前页，1 起 */
	page: number;
	pageCount: number;
	total: number;
	pageSize?: number;
	pageSizeOptions?: number[];
	onPageChange: (page: number) => void;
	onPageSizeChange?: (pageSize: number) => void;
	/** 额外说明，如「已选中 3 条」 */
	hint?: string;
	className?: string;
};

/**
 * 后台分页脚。
 *
 * 与旧版 Pagination 的差异：总数 / 每页条数 / 首页尾页都在同一行，
 * 翻页只换数据不动布局（按钮尺寸固定 8，不随数字位数跳动）。
 */
export function DataTablePagination({
	page,
	pageCount,
	total,
	pageSize,
	pageSizeOptions = DEFAULT_PAGE_SIZES,
	onPageChange,
	onPageSizeChange,
	hint,
	className,
}: DataTablePaginationProps) {
	const safePageCount = Math.max(
		1,
		Math.trunc(Number.isFinite(pageCount) ? pageCount : 1),
	);
	if (safePageCount <= 1 && !hint) return null;
	// 页码夹取：越界页按最后一页渲染，翻页按钮的禁用态也按夹取后的页算
	const safePage = clampPage(page, safePageCount);
	const canPrev = safePage > 1;
	const canNext = safePage < safePageCount;

	return (
		<div
			className={cn(
				"flex flex-col gap-2 px-3 py-2.5 border-t border-border/60 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3",
				className,
			)}
		>
			<div className="flex flex-wrap gap-x-3 gap-y-1 items-baseline text-xs text-muted-foreground">
				<span>
					共{" "}
					<span className="font-medium tabular-nums text-foreground">
						{total.toLocaleString()}
					</span>{" "}
					条
				</span>
				{hint && <span className="text-muted-foreground/80">{hint}</span>}
			</div>

			<div className="flex flex-wrap gap-2 items-center justify-between sm:justify-end">
				{onPageSizeChange && pageSize != null && (
					<div className="flex gap-1.5 items-center">
						<span className="hidden text-xs text-muted-foreground sm:inline">
							每页
						</span>
						<Select
							value={String(pageSize)}
							onValueChange={(value) =>
								value != null && onPageSizeChange(Number(value))
							}
						>
							<SelectTrigger className="h-8 w-16 text-xs tabular-nums">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{pageSizeOptions.map((size) => (
									<SelectItem key={size} value={String(size)}>
										{size}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}

				<div className="flex gap-1 items-center">
					<Button
						variant="outline"
						size="icon-sm"
						aria-label="第一页"
						disabled={!canPrev}
						onClick={() => onPageChange(1)}
						className="hidden sm:inline-flex"
					>
						<ChevronsLeftIcon className="size-4" />
					</Button>
					<Button
						variant="outline"
						size="icon-sm"
						aria-label="上一页"
						disabled={!canPrev}
						onClick={() => onPageChange(safePage - 1)}
					>
						<ChevronLeftIcon className="size-4" />
					</Button>

					<div className="hidden gap-1 items-center sm:flex">
						{pageRange(safePage, safePageCount).map((item, index) =>
							item === "…" ? (
								<span
									key={`gap-${index}`}
									className="px-0.5 text-xs text-muted-foreground/60"
								>
									…
								</span>
							) : (
								<Button
									key={item}
									variant={item === safePage ? "default" : "outline"}
									size="icon-sm"
									aria-current={item === safePage ? "page" : undefined}
									onClick={() => onPageChange(item)}
									className={cn(
										"text-xs tabular-nums",
										item !== safePage && "text-muted-foreground",
									)}
								>
									{item}
								</Button>
							),
						)}
					</div>

					<span className="px-1 text-xs tabular-nums text-muted-foreground sm:hidden">
						{safePage} / {safePageCount}
					</span>

					<Button
						variant="outline"
						size="icon-sm"
						aria-label="下一页"
						disabled={!canNext}
						onClick={() => onPageChange(safePage + 1)}
					>
						<ChevronRightIcon className="size-4" />
					</Button>
					<Button
						variant="outline"
						size="icon-sm"
						aria-label="最后一页"
						disabled={!canNext}
						onClick={() => onPageChange(safePageCount)}
						className="hidden sm:inline-flex"
					>
						<ChevronsRightIcon className="size-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}
