import { useNavigate, useSearch } from "@tanstack/react-router";
import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@web/components/ui/input-group";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@web/components/ui/popover";
import type { GameOrderKey, GameSortKey } from "@web/server/game";
import { CalendarIcon, SearchIcon, XIcon } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

interface SearchInputProps {
	placeholder?: string;
	liveSearch?: boolean;
}

// 以路由 search 作为初值来源（而非 window.location）：SSR 与客户端水合
// 读取同一份值，且在浏览器前进/后退时能随 URL 变化同步。
type SearchInputParams = {
	q?: string;
	startDate?: string;
	endDate?: string;
	sortBy?: GameSortKey;
	order?: GameOrderKey;
};

export default function SearchInput({
	placeholder = "标题、标签、回车，喵喵喵～🐾",
	liveSearch = false,
}: SearchInputProps) {
	const navigate = useNavigate();
	// strict: false —— 本组件同时用于首页（无 search 校验）与 /games（有 schema）
	const routeSearch = useSearch({
		strict: false,
	}) as unknown as SearchInputParams;
	const currentQ = routeSearch.q ?? "";
	const currentStartDate = routeSearch.startDate ?? "";
	const currentEndDate = routeSearch.endDate ?? "";
	const inputRef = useRef<HTMLInputElement>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

	const [inputValue, setInputValue] = useState(currentQ);
	const [startDate, setStartDate] = useState(currentStartDate);
	const [endDate, setEndDate] = useState(currentEndDate);
	const [dateOpen, setDateOpen] = useState(false);

	// URL（导航 / 前进后退）变化时同步输入框与日期，保持本地状态与 search 一致
	useEffect(() => {
		setInputValue((prev) =>
			prev.trim() === currentQ.trim() ? prev : currentQ,
		);
	}, [currentQ]);
	useEffect(() => setStartDate(currentStartDate), [currentStartDate]);
	useEffect(() => setEndDate(currentEndDate), [currentEndDate]);

	const handleSearch = useCallback(
		(searchValue: string) => {
			const trimmed = searchValue.trim();

			const isSame =
				trimmed === currentQ.trim() &&
				startDate === currentStartDate &&
				endDate === currentEndDate;

			if (isSame) return;

			navigate({
				to: "/games",
				search: {
					q: trimmed || undefined,
					startDate: startDate || undefined,
					endDate: endDate || undefined,
					sortBy: routeSearch.sortBy || "released",
					order: routeSearch.order || "desc",
				},
				replace: true,
			});
		},
		[
			navigate,
			startDate,
			endDate,
			currentQ,
			currentStartDate,
			currentEndDate,
			routeSearch.sortBy,
			routeSearch.order,
		],
	);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setInputValue(value);

		if (!liveSearch) return;

		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		debounceRef.current = setTimeout(() => {
			handleSearch(value);
		}, 300);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
			handleSearch(inputValue);
		}
		if (e.key === "Escape" && inputValue) {
			e.preventDefault();
			setInputValue("");
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
			inputRef.current?.blur();
		}
	};

	const handleClear = () => {
		setInputValue("");
		// 清除按钮同时移除日期筛选：URL 与本地状态一起清，避免 badge 与实际过滤不一致
		setStartDate("");
		setEndDate("");
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}
		inputRef.current?.focus();
		navigate({
			to: "/games",
			search: { sortBy: "released", order: "desc" },
			replace: true,
		});
	};

	const handleDateClear = () => {
		setStartDate("");
		setEndDate("");
		// 立即把日期从 URL search 中移除：只改本地 state 会让列表继续被旧日期过滤
		navigate({
			to: "/games",
			search: {
				q: currentQ || undefined,
				sortBy: routeSearch.sortBy || "released",
				order: routeSearch.order || "desc",
			},
			replace: true,
		});
	};

	// 全局 / 快捷键聚焦搜索框
	useEffect(() => {
		const handleGlobalKeyDown = (e: KeyboardEvent) => {
			if (
				e.key === "/" &&
				!e.ctrlKey &&
				!e.metaKey &&
				document.activeElement !== inputRef.current &&
				!(document.activeElement instanceof HTMLInputElement) &&
				!(document.activeElement instanceof HTMLTextAreaElement)
			) {
				e.preventDefault();
				inputRef.current?.focus();
			}
		};

		document.addEventListener("keydown", handleGlobalKeyDown);
		return () => document.removeEventListener("keydown", handleGlobalKeyDown);
	}, []);

	// 清理 debounce
	useEffect(() => {
		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, []);

	const hasDateFilter = !!startDate || !!endDate;

	return (
		<div className="w-full">
			<Popover open={dateOpen} onOpenChange={setDateOpen}>
				<div className="relative">
					<InputGroup className="h-10 bg-background/60 shadow-[0_1px_2px_oklch(0_0_0/0.03)]">
						{/* 搜索图标 */}
						<InputGroupAddon align="inline-start">
							<SearchIcon className="size-4 text-muted-foreground" />
						</InputGroupAddon>

						{/* 主输入框 */}
						<InputGroupInput
							ref={inputRef}
							type="text"
							aria-keyshortcuts="/"
							title="按 / 快速聚焦搜索"
							value={inputValue}
							onChange={handleInputChange}
							onKeyDown={handleKeyDown}
							placeholder={placeholder}
						/>

						{/* 清除按钮（仅在输入内容时显示） */}
						{inputValue && (
							<InputGroupAddon align="inline-end">
								<InputGroupButton
									variant="ghost"
									size="icon-xs"
									onClick={handleClear}
									aria-label="清除搜索"
									className="text-muted-foreground hover:text-foreground"
								>
									<XIcon className="size-4" />
								</InputGroupButton>
							</InputGroupAddon>
						)}

						{/* 日期筛选按钮 */}
						<InputGroupAddon align="inline-end">
							<PopoverTrigger
								render={
									<InputGroupButton
										variant="ghost"
										size="icon-sm"
										data-active={hasDateFilter || undefined}
										className={
											hasDateFilter
												? "text-primary bg-primary/10 hover:text-primary hover:bg-primary/15"
												: "text-muted-foreground hover:text-foreground"
										}
									/>
								}
							>
								<CalendarIcon className="size-4" />
							</PopoverTrigger>
						</InputGroupAddon>

						{/* 搜索按钮 */}
						<InputGroupAddon align="inline-end">
							<InputGroupButton
								variant="default"
								className="mr-0.5"
								onClick={() => handleSearch(inputValue)}
							>
								<SearchIcon className="size-4" />
								搜索
							</InputGroupButton>
						</InputGroupAddon>
					</InputGroup>
				</div>

				{/* 日期筛选结果标签 */}
				{hasDateFilter && (
					<div className="flex gap-2 items-center mt-2">
						<Badge className="gap-1 m-0" variant="outline">
							<CalendarIcon className="size-3" />
							{`${startDate || "不限"} — ${endDate || "不限"}`}
							<button
								type="button"
								onClick={handleDateClear}
								className="ml-0.5 cursor-pointer hover:text-foreground"
								aria-label="清除日期筛选"
							>
								<XIcon className="size-3" />
							</button>
						</Badge>
					</div>
				)}

				{/* 日期筛选 Popover */}
				<PopoverContent align="end" className="p-3 w-auto rounded-xl">
					<div className="grid grid-cols-2 gap-3">
						<div className="flex flex-col gap-1.5">
							<span className="text-xs font-medium text-muted-foreground">
								开始日期
							</span>
							<Input
								type="date"
								value={startDate}
								onChange={(e) => setStartDate(e.target.value)}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<span className="text-xs font-medium text-muted-foreground">
								结束日期
							</span>
							<Input
								type="date"
								value={endDate}
								onChange={(e) => setEndDate(e.target.value)}
							/>
						</div>
					</div>
					{hasDateFilter && (
						<div className="flex justify-end pt-2 mt-2 border-t border-border">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									handleDateClear();
									setDateOpen(false);
								}}
								className="text-xs text-muted-foreground"
							>
								清除日期
							</Button>
						</div>
					)}
				</PopoverContent>
			</Popover>
		</div>
	);
}
