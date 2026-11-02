import { PageHeader } from "@web/components/shared/page-header";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * 管理端页面头：与用户端共用 PageHeader，仅保留眉标语义。
 * 这样后台的可选图标、标题字号、描述、右侧操作与前台完全同构。
 */
export function AdminPageHeader({
	title,
	description,
	eyebrow,
	actions,
	icon,
}: {
	title: string;
	description?: string;
	/** 所属分组眉标，如「内容管理」「系统」 */
	eyebrow?: string;
	actions?: ReactNode;
	icon?: LucideIcon;
}) {
	return (
		<PageHeader
			icon={icon}
			eyebrow={eyebrow}
			title={title}
			description={description}
			actions={actions}
		/>
	);
}
