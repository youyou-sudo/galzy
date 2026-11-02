import { Button } from "@web/components/ui/button";
import { cn } from "@web/lib/utils";
import { XIcon } from "lucide-react";
import type { TaskChip } from "./types";

/** 页面组装 chips 时用的类型：从 chips 组件导入，避免再绕回 types.ts。 */
export type { TaskChip };

export type TaskFilterChipsProps = {
	/** 已生效条件，每枚自带 onRemove（由状态层构造） */
	chips: TaskChip[];
	onClearAll: () => void;
	className?: string;
};

/**
 * 生效条件 chips 行：每枚 chip 有独立的 × 按钮，末尾一键全清。
 *
 * 为什么 chip 自己带 onRemove：状态层最清楚「移除这一条」该改哪个键
 * （status 是数组、q 是字符串、overdue 是布尔），组件层只负责渲染。
 * 空数组直接不渲染，避免页面上留一行空白。
 */
export function TaskFilterChips({
	chips,
	onClearAll,
	className,
}: TaskFilterChipsProps) {
	if (chips.length === 0) return null;

	return (
		<fieldset
			aria-label="已生效的筛选条件"
			className={cn("flex flex-wrap min-w-0 gap-1.5 items-center", className)}
		>
			{chips.map((chip) => (
				<span
					key={chip.key}
					className="inline-flex overflow-hidden items-center h-6 max-w-full text-xs bg-muted rounded-full ring-1 ring-border/60"
				>
					<span className="px-2 truncate max-w-48 text-foreground/80">
						{chip.label}
					</span>
					<button
						type="button"
						onClick={chip.onRemove}
						aria-label={`移除筛选：${chip.label}`}
						title={`移除筛选：${chip.label}`}
						className="flex justify-center items-center mr-0.5 size-5 shrink-0 text-muted-foreground rounded-full transition-colors hover:text-foreground hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
					>
						<XIcon className="size-3" />
					</button>
				</span>
			))}

			<Button
				variant="ghost"
				size="xs"
				onClick={onClearAll}
				className="gap-1 px-1.5 font-normal text-muted-foreground"
			>
				<XIcon className="size-3" />
				清除全部
			</Button>
		</fieldset>
	);
}
