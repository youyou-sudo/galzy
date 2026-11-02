import { Input } from "@web/components/ui/input";
import { cn } from "@web/lib/utils";
import { Search, X } from "lucide-react";
import type { KeyboardEvent } from "react";

/**
 * 简单搜索框：搜索图标 + 输入框 + 清除按钮。
 *
 * 用于标签库/厂商/后台等「输入即筛选」场景；首页带日期筛选的复合搜索框
 * 仍由 home/search/Search.tsx 自己组合，但外观与本组件保持同一套（h-9/rounded-xl）。
 */
export function SearchField({
	value,
	onChange,
	onSubmit,
	onClear,
	placeholder = "搜索…",
	ariaLabel = "搜索",
	className,
	inputClassName,
	disabled,
}: {
	value: string;
	onChange: (value: string) => void;
	onSubmit?: (value: string) => void;
	onClear?: () => void;
	placeholder?: string;
	ariaLabel?: string;
	className?: string;
	inputClassName?: string;
	disabled?: boolean;
}) {
	const clear = () => {
		onChange("");
		onClear?.();
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") {
			event.preventDefault();
			onSubmit?.(value);
		}
		if (event.key === "Escape" && value) {
			event.preventDefault();
			clear();
		}
	};

	return (
		<div className={cn("relative w-full", className)}>
			<Search
				aria-hidden="true"
				className="absolute top-1/2 left-3 size-4 text-muted-foreground -translate-y-1/2 pointer-events-none"
			/>
			<Input
				type="text"
				role="searchbox"
				aria-label={ariaLabel}
				value={value}
				disabled={disabled}
				onChange={(event) => onChange(event.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				className={cn(
					"px-9 h-9 bg-background/60 rounded-xl",
					inputClassName,
				)}
			/>
			{value && (
				<button
					type="button"
					onClick={clear}
					aria-label="清除搜索"
					className="flex absolute top-1/2 right-2 justify-center items-center size-6 text-muted-foreground rounded-md transition-colors -translate-y-1/2 hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
				>
					<X className="size-3.5" />
				</button>
			)}
		</div>
	);
}
