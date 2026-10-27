import { Button } from "@web/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@web/components/ui/dropdown-menu";
import { Spinner } from "@web/components/ui/spinner";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@web/components/ui/tooltip";
import { cn } from "@web/lib/utils";
import { EllipsisIcon } from "lucide-react";
import type { AdminRowAction } from "./types";

/** 高频操作的图标按钮：disabled 时仍保留 title，说明为什么不可用。 */
function PrimaryActionButton({ action }: { action: AdminRowAction }) {
	const Icon = action.icon;
	const disabled =
		!!action.disabled || !!action.pending || !!action.disabledReason;
	const hint = action.disabledReason ?? action.label;

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={action.label}
						// 禁用态下原生 title 兜底（base-ui Tooltip 在 disabled 按钮上不触发），
						// 可用时不设 title，避免与 Tooltip 双气泡
						title={disabled ? hint : undefined}
						disabled={disabled}
						onClick={action.onSelect}
						className={cn(
							"text-muted-foreground",
							action.variant === "destructive" && "text-destructive",
						)}
					/>
				}
			>
				{action.pending ? (
					<Spinner className="size-4" />
				) : Icon ? (
					<Icon className="size-4" />
				) : null}
			</TooltipTrigger>
			<TooltipContent>{hint}</TooltipContent>
		</Tooltip>
	);
}

/**
 * 行操作菜单。
 *
 * 高频操作（1-2 个）直接用图标按钮放在左侧，其余收进 ⋯ 菜单 ——
 * 6 个按钮平铺在表格里会把行高撑到 48px 以上，且很难扫读。
 */
export function RowActionsMenu({
	actions,
	primaryActions,
	label = "更多操作",
	align = "end",
}: {
	actions: AdminRowAction[];
	/** 外露成图标按钮的高频操作，渲染在 ⋯ 菜单左侧 */
	primaryActions?: AdminRowAction[];
	label?: string;
	align?: "start" | "end";
}) {
	const visible = actions.filter((action) => !action.hidden);
	const visiblePrimary = (primaryActions ?? []).filter(
		(action) => !action.hidden,
	);
	if (visible.length === 0 && visiblePrimary.length === 0) return null;

	return (
		<>
			{visiblePrimary.map((action) => (
				<PrimaryActionButton key={action.label} action={action} />
			))}
			{visible.length > 0 && (
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label={label}
								className="text-muted-foreground"
							/>
						}
					>
						<EllipsisIcon className="size-4" />
					</DropdownMenuTrigger>
					<DropdownMenuContent align={align} className="w-44">
						{visible.map((action) => {
							const Icon = action.icon;
							return (
								<div key={action.label}>
									{action.separator && <DropdownMenuSeparator />}
									<DropdownMenuItem
										variant={action.variant}
										disabled={
											action.disabled ||
											action.pending ||
											!!action.disabledReason
										}
										onClick={action.onSelect}
										// 菜单项用 title 解释禁用原因：Base UI 的菜单项不支持嵌套 Tooltip
										title={action.disabledReason}
										className={cn(action.pending && "opacity-70")}
									>
										{action.pending ? (
											<Spinner className="size-4" />
										) : Icon ? (
											<Icon className="size-4" />
										) : null}
										{action.label}
									</DropdownMenuItem>
								</div>
							);
						})}
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</>
	);
}
