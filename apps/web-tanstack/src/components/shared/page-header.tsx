import { cn } from "@web/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { IconTile } from "./icon-tile";

/**
 * 用户端统一页面头。
 *
 * 结构固定：图标底片 + 标题（+ 行内计数/眉标）+ 描述 + 右侧操作。
 * 各页不再自拼 h1/描述/操作区的间距与字号。
 */
export function PageHeader({
	icon,
	title,
	description,
	meta,
	eyebrow,
	actions,
	align = "start",
	className,
}: {
	icon?: LucideIcon;
	title: ReactNode;
	description?: ReactNode;
	/** 标题右侧的行内信息，如「共 128 个」 */
	meta?: ReactNode;
	/** 标题上方的小眉标 */
	eyebrow?: ReactNode;
	actions?: ReactNode;
	align?: "start" | "center";
	className?: string;
}) {
	const centered = align === "center";

	return (
		<header
			className={cn(
				"flex flex-col gap-4 mb-6 sm:flex-row sm:justify-between sm:items-start",
				centered && "items-center text-center sm:flex-col sm:items-center",
				className,
			)}
		>
			<div
				className={cn(
					"flex flex-col gap-1.5 min-w-0",
					centered && "items-center",
				)}
			>
				{eyebrow && (
					<p className="text-[11px] font-medium tracking-wider text-muted-foreground/70 uppercase">
						{eyebrow}
					</p>
				)}
				<div
					className={cn(
						"flex flex-wrap gap-x-3 gap-y-1 items-center min-w-0",
						centered && "justify-center",
					)}
				>
					{icon && <IconTile icon={icon} size="md" />}
					<h1 className="min-w-0 text-2xl font-semibold tracking-tight text-balance">
						{title}
					</h1>
					{meta && (
						<span className="text-sm tabular-nums text-muted-foreground">
							{meta}
						</span>
					)}
				</div>
				{description && (
					<p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
						{description}
					</p>
				)}
			</div>
			{actions && (
				<div className="flex flex-wrap shrink-0 gap-2 items-center">
					{actions}
				</div>
			)}
		</header>
	);
}
