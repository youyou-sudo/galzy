import { Button } from "@web/components/ui/button";
import { cn } from "@web/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactElement } from "react";

/** 生成紧凑页码：[1, …, 4, 5, 6, …, 10] */
function paginationRange(current: number, total: number): (number | "…")[] {
	if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

	if (current <= 3) return [1, 2, 3, 4, "…", total];
	if (current >= total - 2)
		return [1, "…", total - 3, total - 2, total - 1, total];
	return [1, "…", current - 1, current, current + 1, "…", total];
}

type PaginationProps = {
	page: number;
	totalPages: number;
	/** 回调式分页（后台/客户端状态） */
	onPageChange?: (page: number) => void;
	/** 链接式分页（公开页 URL search）：返回每个页码对应的 <Link /> 元素 */
	renderLink?: (page: number) => ReactElement;
	/** compact：只显示上一页/下一页 + 第 x / y 页 */
	variant?: "default" | "compact";
	/** 结果总数，展示在左侧（可选） */
	totalItems?: number;
	className?: string;
};

/**
 * 全站唯一分页组件。
 *
 * 公开页用 renderLink（保留预取/可右键新开），后台与本地状态用 onPageChange。
 * 移动端收起数字页码，避免 375px 下一行挤 7 个按钮。
 */
export function Pagination({
	page,
	totalPages,
	onPageChange,
	renderLink,
	variant = "default",
	totalItems,
	className,
}: PaginationProps) {
	if (totalPages <= 1) return null;

	const go = (next: number) => onPageChange?.(next);

	const navButton = (
		key: "prev" | "next",
		label: string,
		target: number,
		disabled: boolean,
		icon: typeof ChevronLeft,
	) => {
		const Icon = icon;
		const content = (
			<>
				{key === "prev" && <Icon className="size-4" />}
				{label}
				{key === "next" && <Icon className="size-4" />}
			</>
		);
		if (!disabled && renderLink) {
			return (
				<Button
					key={key}
					variant="outline"
					size="sm"
					className="gap-1 h-8"
					render={renderLink(target)}
				>
					{content}
				</Button>
			);
		}
		return (
			<Button
				key={key}
				variant="outline"
				size="sm"
				className="gap-1 h-8"
				disabled={disabled}
				onClick={() => go(target)}
			>
				{content}
			</Button>
		);
	};

	return (
		<nav
			aria-label="分页"
			className={cn(
				"flex gap-2 justify-center items-center pt-8",
				totalItems !== undefined && "sm:justify-between",
				className,
			)}
		>
			{totalItems !== undefined && (
				<p className="hidden text-sm tabular-nums text-muted-foreground sm:block">
					共 {totalItems} 条
				</p>
			)}
			<div className="flex gap-2 items-center">
				{navButton("prev", "上一页", page - 1, page <= 1, ChevronLeft)}

				{variant === "compact" || totalPages <= 1 ? (
					<span className="px-1 text-sm tabular-nums text-muted-foreground">
						{page} / {totalPages}
					</span>
				) : (
					<>
						<div className="hidden gap-1 items-center sm:flex">
							{paginationRange(page, totalPages).map((item, index) =>
								item === "…" ? (
									<span
										key={`dots-${index}`}
										className="px-1 text-sm text-muted-foreground"
									>
										…
									</span>
								) : (
									<PageNumber
										key={item}
										page={item}
										active={item === page}
										renderLink={renderLink}
										onPageChange={onPageChange}
									/>
								),
							)}
						</div>
						<span className="px-1 text-sm tabular-nums text-muted-foreground sm:hidden">
							{page} / {totalPages}
						</span>
					</>
				)}

				{navButton(
					"next",
					"下一页",
					page + 1,
					page >= totalPages,
					ChevronRight,
				)}
			</div>
		</nav>
	);
}

function PageNumber({
	page,
	active,
	renderLink,
	onPageChange,
}: {
	page: number;
	active: boolean;
	renderLink?: (page: number) => ReactElement;
	onPageChange?: (page: number) => void;
}) {
	const className = "px-2 min-w-9 h-8 tabular-nums";
	if (renderLink) {
		return (
			<Button
				variant={active ? "default" : "outline"}
				size="sm"
				className={className}
				aria-current={active ? "page" : undefined}
				render={renderLink(page)}
			>
				{page}
			</Button>
		);
	}
	return (
		<Button
			variant={active ? "default" : "outline"}
			size="sm"
			className={className}
			aria-current={active ? "page" : undefined}
			onClick={() => onPageChange?.(page)}
		>
			{page}
		</Button>
	);
}
