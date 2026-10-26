import { cn } from "@web/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { IconTile } from "./icon-tile";

/** 区块标题右侧「更多 →」等的统一样式，调用方只负责传 Link */
export const sectionActionClass =
	"inline-flex gap-1 items-center text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground sm:text-sm";

/**
 * 区块标题行：图标底片 + 标题 + 计数 + 右侧动作。
 *
 * 首页各区块、列表页内的分组都用这一份，标题字号/间距/对齐不再各写一套。
 */
export function SectionHeader({
	icon,
	title,
	count,
	action,
	className,
}: {
	icon?: LucideIcon;
	title: ReactNode;
	count?: ReactNode;
	action?: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex gap-3 justify-between items-center mb-4",
				className,
			)}
		>
			<div className="flex gap-2.5 items-center min-w-0">
				{icon && <IconTile icon={icon} size="sm" />}
				<h2 className="min-w-0 text-lg font-semibold tracking-tight truncate">
					{title}
				</h2>
				{count !== undefined && (
					<span className="shrink-0 text-sm tabular-nums text-muted-foreground">
						{count}
					</span>
				)}
			</div>
			{action && <div className="shrink-0">{action}</div>}
		</div>
	);
}
