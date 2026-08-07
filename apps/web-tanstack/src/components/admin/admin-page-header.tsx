import type { ReactNode } from "react";

/**
 * 管理端统一页面头：眉标（所属分组）+ 标题 + 描述 + 操作区。
 * 与用户端页面头部视觉完全区分：眉标大写字母间距、无边框大标题。
 */
export function AdminPageHeader({
	title,
	description,
	eyebrow,
	actions,
}: {
	title: string;
	description?: string;
	/** 所属分组眉标，如「内容管理」「系统」 */
	eyebrow?: string;
	actions?: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div className="flex flex-col gap-1.5">
				{eyebrow && (
					<p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
						{eyebrow}
					</p>
				)}
				<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
				{description && (
					<p className="text-sm text-muted-foreground">{description}</p>
				)}
			</div>
			{actions && (
				<div className="flex shrink-0 items-center gap-2">{actions}</div>
			)}
		</div>
	);
}
