import { GameCard } from "@web/components/home/card";
import { cn } from "@web/lib/utils";

/**
 * 游戏卡片栅格骨架：列表首屏、路由 pending、虚拟列表尚未测量、系列页签共用。
 * className 用来覆盖栅格断点（例如系列页签是 2/3/4/5/6 列），卡片骨架本身只有一份。
 */
export function GameCardGridSkeleton({
	className,
	count = 6,
}: {
	className?: string;
	count?: number;
}) {
	return (
		<div
			className={cn("grid grid-cols-3 gap-4 md:grid-cols-6", className)}
			aria-hidden
		>
			{Array.from({ length: count }, (_, i) => (
				<GameCard.ListSkeleton key={i} />
			))}
		</div>
	);
}
