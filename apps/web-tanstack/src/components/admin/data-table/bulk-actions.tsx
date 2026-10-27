import { Button } from "@web/components/ui/button";
import { cn } from "@web/lib/utils";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * 批量操作条：选中行后从底部浮出。
 *
 * 用 fixed 定位而不是插在表格里，避免选中/取消时把下面的内容顶来顶去；
 * translate-y 进入动画只走合成层，列表滚动时不会掉帧。
 */
export function DataTableBulkActions({
	count,
	onClear,
	children,
	className,
}: {
	count: number;
	onClear: () => void;
	children?: ReactNode;
	className?: string;
}) {
	if (count === 0) return null;

	return (
		<div
			role="region"
			aria-label="批量操作"
			className={cn(
				"fixed bottom-5 left-1/2 z-40 flex gap-2 items-center px-3 py-2 max-w-[calc(100vw-2rem)] text-sm rounded-2xl shadow-lg -translate-x-1/2",
				"bg-popover/95 ring-1 ring-border/60 backdrop-blur-xl animate-in fade-in-0 slide-in-from-bottom-2 duration-200",
				className,
			)}
		>
			<span className="px-1 whitespace-nowrap text-muted-foreground">
				已选{" "}
				<span className="font-medium tabular-nums text-foreground">
					{count}
				</span>{" "}
				项
			</span>
			<span className="w-px h-5 bg-border" />
			{children}
			<Button
				variant="ghost"
				size="icon-sm"
				aria-label="取消选择"
				onClick={onClear}
				className="ml-1 text-muted-foreground"
			>
				<XIcon className="size-4" />
			</Button>
		</div>
	);
}
