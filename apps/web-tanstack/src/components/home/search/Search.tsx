import { useNavigate } from "@tanstack/react-router";
import { CalendarIcon, SearchIcon, XIcon } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

// SSR-safe: 服务端无 window 对象
function getSearchParam(key: string): string {
	if (typeof window === "undefined") return "";
	return new URLSearchParams(window.location.search).get(key) ?? "";
}

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

interface SearchInputProps {
	placeholder?: string;
	liveSearch?: boolean;
}

export default function SearchInput({
	placeholder = "标题、标签、回车，喵喵喵～🐾",
	liveSearch = false,
}: SearchInputProps) {
	const navigate = useNavigate();
	const inputRef = useRef<HTMLInputElement>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

	const [inputValue, setInputValue] = useState(() => getSearchParam("q"));
	const [startDate, setStartDate] = useState(() => getSearchParam("startDate"));
	const [endDate, setEndDate] = useState(() => getSearchParam("endDate"));
	const [dateOpen, setDateOpen] = useState(false);

	const handleSearch = useCallback(
		(searchValue: string) => {
			const trimmed = searchValue.trim();

			const params =
				typeof window !== "undefined"
					? new URLSearchParams(window.location.search)
					: new URLSearchParams();

			const isSame =
				trimmed === params.get("q") &&
				startDate === (params.get("startDate") ?? "") &&
				endDate === (params.get("endDate") ?? "");

			if (isSame) return;

			navigate({
				to: "/games",
				search: {
					q: trimmed || undefined,
					startDate: startDate || undefined,
					endDate: endDate || undefined,
					sortBy: params.get("sortBy") || "released",
					order: params.get("order") || "desc",
				},
				replace: true,
			});
		},
		[navigate, startDate, endDate],
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
					<InputGroup className="border-2 rounded-lg">
						{/* 搜索图标 */}
						<InputGroupAddon align="inline-start">
							<SearchIcon className="size-4 text-muted-foreground" />
						</InputGroupAddon>

						{/* 主输入框 */}
						<InputGroupInput
							ref={inputRef}
							type="text"
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
										variant="secondary"
										size="icon-xs"
										data-active={hasDateFilter || undefined}
										className={
											hasDateFilter ? "text-primary bg-primary/10" : ""
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
								variant="secondary"
								onClick={() => handleSearch(inputValue)}
							>
								<SearchIcon className="size-4 mr-1" />
								搜索
							</InputGroupButton>
						</InputGroupAddon>
					</InputGroup>
				</div>

				{/* 日期筛选结果标签 */}
				{hasDateFilter && (
					<div className="flex items-center gap-2 mt-2">
						<Badge className="m-0 gap-1" variant="outline">
							<CalendarIcon className="size-3" />
							{`${startDate || "不限"} — ${endDate || "不限"}`}
							<button
								type="button"
								onClick={handleDateClear}
								className="ml-0.5 hover:text-foreground cursor-pointer"
								aria-label="清除日期筛选"
							>
								<XIcon className="size-3" />
							</button>
						</Badge>
					</div>
				)}

				{/* 日期筛选 Popover */}
				<PopoverContent align="end" className="w-auto p-3">
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
						<div className="flex justify-end mt-2 pt-2 border-t border-border">
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
