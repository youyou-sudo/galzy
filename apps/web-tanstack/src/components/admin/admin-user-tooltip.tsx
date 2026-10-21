import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@web/components/ui/tooltip";
import { cn } from "@web/lib/utils";

export interface AdminUserTooltipUser {
	id: string;
	name: string;
	email?: string | null;
}

/**
 * 管理后台表格里的用户名：悬停时展示该用户的邮箱与 ID。
 *
 * 表格行排得比较密，气泡统一不接收指针事件（positioner 加 pointer-events-none），
 * 避免气泡盖住紧邻的下一行、挡住操作按钮。仅展示文字，无需气泡内交互。
 */
export function AdminUserTooltip({
	user,
	fallback = "未知",
	className,
}: {
	user?: AdminUserTooltipUser | null;
	fallback?: string;
	className?: string;
}) {
	const label = user?.name || fallback;

	if (!user) {
		return <span className={className}>{label}</span>;
	}

	return (
		<Tooltip>
			<TooltipTrigger
				render={<span className={cn("cursor-default", className)} />}
			>
				{label}
			</TooltipTrigger>
			<TooltipContent positionerClassName="pointer-events-none">
				<span className="flex flex-col gap-0.5 leading-tight">
					<span className="font-medium">{label}</span>
					<span className="break-all opacity-80">{user.email || "无邮箱"}</span>
					<span className="font-mono opacity-60">ID: {user.id}</span>
				</span>
			</TooltipContent>
		</Tooltip>
	);
}
