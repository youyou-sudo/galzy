import { cn } from "@web/lib/utils";
import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { IconTile } from "./icon-tile";

/**
 * 全站统一空态：图标底片 + 标题 + 说明 + 可选动作。
 *
 * 取代各页手写的「居中 + opacity-30 大图标 + 两行灰字」。
 * surface 用于需要一块卡片底的空态（如详情页内部区块）。
 */
export function EmptyState({
	icon = Inbox,
	title,
	description,
	action,
	surface = false,
	size = "md",
	className,
}: {
	icon?: LucideIcon;
	title: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
	surface?: boolean;
	size?: "sm" | "md";
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-col justify-center items-center px-6 text-center",
				size === "sm" ? "py-10" : "py-16",
				surface && "bg-card/60 rounded-2xl ring-1 ring-border/60",
				className,
			)}
		>
			<IconTile
				icon={icon}
				size={size === "sm" ? "md" : "lg"}
				tone="muted"
				className={size === "sm" ? "mb-3" : "mb-4"}
			/>
			<p
				className={cn(
					"font-medium text-foreground/80",
					size === "sm" ? "text-sm" : "text-base",
				)}
			>
				{title}
			</p>
			{description && (
				<p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
					{description}
				</p>
			)}
			{action && <div className="mt-5">{action}</div>}
		</div>
	);
}
