import { Check, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@web/lib/utils";
import { ThemeIcon } from "./theme-icon";
import type { ThemeMode } from "./theme-icon";
import { Button } from "./ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export type { ThemeMode } from "./theme-icon";

export type ThemeMenuAppearance = {
	/** 与 ThemeToggle 收起态保持一致，否则展开瞬间按钮会「变脸」 */
	variant?: "outline" | "ghost";
	size?: "icon" | "icon-sm" | "icon-lg";
	className?: string;
};

// 懒加载的主题下拉菜单：dropdown-menu 代码只在首次打开时进入客户端
export function ThemeMenu({
	open,
	mode,
	onOpenChange,
	onSelect,
	variant = "outline",
	size = "icon",
	className,
}: {
	open: boolean;
	mode: ThemeMode;
	onOpenChange: (open: boolean) => void;
	onSelect: (mode: ThemeMode) => void;
} & ThemeMenuAppearance) {
	return (
		<DropdownMenu open={open} onOpenChange={onOpenChange}>
			<DropdownMenuTrigger
				render={
					<Button
						variant={variant}
						size={size}
						className={cn("rounded-lg", className)}
						aria-label="切换主题"
					/>
				}
			>
				<ThemeIcon mode={mode} />
				<span className="sr-only">主题</span>
			</DropdownMenuTrigger>

			<DropdownMenuContent align="end" className="min-w-32 rounded-xl">
				<DropdownMenuItem
					className="flex items-center gap-2 cursor-pointer"
					onClick={() => onSelect("light")}
				>
					<Sun className="size-4 text-warning" />
					<span>浅色</span>
					{mode === "light" && <Check className="size-4 ml-auto" />}
				</DropdownMenuItem>

				<DropdownMenuItem
					className="flex items-center gap-2 cursor-pointer"
					onClick={() => onSelect("dark")}
				>
					<Moon className="size-4 text-info" />
					<span>深色</span>
					{mode === "dark" && <Check className="size-4 ml-auto" />}
				</DropdownMenuItem>

				<DropdownMenuItem
					className="flex items-center gap-2 cursor-pointer"
					onClick={() => onSelect("auto")}
				>
					<Monitor className="size-4 text-muted-foreground" />
					<span>跟随系统</span>
					{mode === "auto" && <Check className="size-4 ml-auto" />}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
