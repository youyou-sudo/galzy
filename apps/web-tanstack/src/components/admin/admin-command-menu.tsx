import { useNavigate } from "@tanstack/react-router";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@web/components/ui/dialog";
import { Input } from "@web/components/ui/input";
import { cn } from "@web/lib/utils";
import { CornerDownLeftIcon, SearchIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { type AdminNavItem, adminNav } from "./admin-nav";

type CommandEntry = {
	section: string;
	item: AdminNavItem;
	/** 供检索的合成串 */
	haystack: string;
};

const entries: CommandEntry[] = adminNav.flatMap((section) =>
	section.items.map((item) => ({
		section: section.section,
		item,
		haystack: [item.label, item.description, item.to, ...(item.keywords ?? [])]
			.join(" ")
			.toLowerCase(),
	})),
);

/**
 * 后台命令面板（⌘K / Ctrl+K）。
 *
 * 后台有 10 个入口，侧栏够用但键盘用户每次都要摸鼠标；
 * 这里给「跳到任意页面」一条键盘路径，也顺手统一了顶栏的搜索入口。
 */
export function AdminCommandMenu({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const navigate = useNavigate();
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const listRef = useRef<HTMLDivElement>(null);

	const results = useMemo(() => {
		const keyword = query.trim().toLowerCase();
		if (!keyword) return entries;
		return entries.filter((entry) => {
			// 空格分词后逐词包含即可命中，支持「同步 vndb」这类乱序输入
			return keyword
				.split(/\s+/)
				.every((token) => entry.haystack.includes(token));
		});
	}, [query]);

	useEffect(() => {
		if (!open) {
			setQuery("");
			setActiveIndex(0);
		}
	}, [open]);

	useEffect(() => {
		setActiveIndex(0);
	}, [query]);

	useEffect(() => {
		const active = listRef.current?.querySelector<HTMLElement>(
			"[data-command-active='true']",
		);
		active?.scrollIntoView({ block: "nearest" });
	}, [activeIndex]);

	const select = (entry: CommandEntry | undefined) => {
		if (!entry) return;
		onOpenChange(false);
		void navigate({ to: entry.item.to });
	};

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setActiveIndex((index) =>
				results.length === 0 ? 0 : (index + 1) % results.length,
			);
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setActiveIndex((index) =>
				results.length === 0
					? 0
					: (index - 1 + results.length) % results.length,
			);
		} else if (event.key === "Enter") {
			event.preventDefault();
			select(results[activeIndex]);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={false}
				className="top-[18%] gap-0 p-0 max-w-lg -translate-y-0 overflow-hidden"
			>
				<DialogTitle className="sr-only">后台导航搜索</DialogTitle>
				<DialogDescription className="sr-only">
					输入页面名称快速跳转
				</DialogDescription>

				<div className="flex gap-2 items-center px-3 border-b border-border/60">
					<SearchIcon className="size-4 text-muted-foreground" />
					<Input
						autoFocus
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="搜索后台页面…"
						aria-label="搜索后台页面"
						className="px-0 h-11 bg-transparent border-0 rounded-none shadow-none focus-visible:ring-0"
					/>
					<kbd className="hidden px-1.5 h-5 text-[10px] font-medium text-muted-foreground bg-muted rounded sm:block">
						ESC
					</kbd>
				</div>

				<div
					ref={listRef}
					role="listbox"
					aria-label="后台页面"
					className="overflow-y-auto p-1.5 max-h-80"
				>
					{results.length === 0 ? (
						<p className="px-3 py-8 text-sm text-center text-muted-foreground">
							没有匹配的页面
						</p>
					) : (
						results.map((entry, index) => {
							const Icon = entry.item.icon;
							const active = index === activeIndex;
							return (
								<button
									key={entry.item.to}
									type="button"
									role="option"
									aria-selected={active}
									data-command-active={active}
									onMouseMove={() => setActiveIndex(index)}
									onClick={() => select(entry)}
									className={cn(
										"flex gap-2.5 items-center w-full px-2.5 py-2 text-left rounded-lg transition-colors",
										active
											? "bg-accent text-accent-foreground"
											: "text-foreground",
									)}
								>
									<span
										className={cn(
											"flex justify-center items-center size-7 rounded-md",
											active
												? "bg-primary/10 text-primary"
												: "bg-muted/60 text-muted-foreground",
										)}
									>
										<Icon className="size-3.5" />
									</span>
									<span className="flex flex-col flex-1 min-w-0">
										<span className="text-sm font-medium truncate">
											{entry.item.label}
										</span>
										<span className="text-xs truncate text-muted-foreground">
											{entry.item.description}
										</span>
									</span>
									<span className="text-[11px] text-muted-foreground/70 shrink-0">
										{entry.section}
									</span>
									{active && (
										<CornerDownLeftIcon className="size-3.5 text-muted-foreground" />
									)}
								</button>
							);
						})
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
