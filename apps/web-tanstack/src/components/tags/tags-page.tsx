import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@web/components/ui/select";
import { getSearchTags, getTagCategories } from "@web/server/tags";
import { List, SearchIcon, TagsIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type TagHit = {
	id: string;
	name: string;
	zh_name?: string;
	alias?: string;
};
export type TagCategoryItem = {
	id: string;
	name: string;
	vnCount: number;
	views: number;
};
export type TagCategories = {
	cont: TagCategoryItem[];
	ero: TagCategoryItem[];
	tech: TagCategoryItem[];
};
export type TagCat = "all" | "cont" | "ero" | "tech";
export type TagSort = "views" | "nameAsc" | "nameDesc";

const CAT_LABEL: Record<TagCat, string> = {
	all: "全部标签",
	cont: "剧情",
	ero: "性爱",
	tech: "技术",
};

const SORT_LABEL: Record<TagSort, string> = {
	views: "浏览量",
	nameAsc: "名称正序",
	nameDesc: "名称倒序",
};

type DebounceTimer = ReturnType<typeof setTimeout>;

const INITIAL_VISIBLE = 24;
const VISIBLE_STEP = 48;

export default function TagsIndexPage({
	q,
	cat,
	sort,
}: {
	q: string | undefined;
	cat: TagCat;
	sort: TagSort;
}) {
	const navigate = useNavigate();
	const [inputValue, setInputValue] = useState(q || "");
	const debounceRef = useRef<DebounceTimer>(null);

	const handleSearch = useCallback(
		(value: string) => {
			const trimmed = value.trim();
			navigate({
				to: "/tags",
				search: { ...(trimmed ? { q: trimmed } : {}), cat, sort },
				replace: true,
			});
		},
		[navigate, cat, sort],
	);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setInputValue(value);

		clearTimeout(debounceRef.current ?? undefined);

		debounceRef.current = setTimeout(() => {
			handleSearch(value);
		}, 300);
	};

	const handleClear = () => {
		setInputValue("");
		navigate({ to: "/tags", search: { cat, sort }, replace: true });
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			clearTimeout(debounceRef.current ?? undefined);
			handleSearch(inputValue);
		}
	};

	useEffect(() => {
		return () => {
			clearTimeout(debounceRef.current ?? undefined);
		};
	}, []);

	// URL 回退/前进时同步输入框
	useEffect(() => {
		setInputValue(q || "");
	}, [q]);

	const searchQ = q?.trim();

	return (
		<section className="max-w-5xl mx-auto py-3 px-0 sm:px-3 flex flex-col gap-8">
			<div className="text-center flex flex-col gap-1.5">
				<div className="flex items-center justify-center gap-2">
					<TagsIcon className="size-5 text-primary" />
					<h1 className="text-xl font-bold">游戏标签</h1>
				</div>
				<p className="text-sm text-muted-foreground">
					浏览、搜索与发现游戏标签
				</p>
			</div>

			<div className="mx-auto md:w-1/2">
				<div className="relative">
					<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
					<Input
						type="text"
						value={inputValue}
						onChange={handleInputChange}
						onKeyDown={handleKeyDown}
						placeholder="搜索标签名称（中文 / 英文 / 别名）…"
						className="pl-9 pr-8"
					/>
					{inputValue && (
						<button
							type="button"
							onClick={handleClear}
							className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
							aria-label="清除搜索"
						>
							<XIcon className="size-4" />
						</button>
					)}
				</div>
			</div>

			{searchQ ? (
				<TagSearchResults q={searchQ} />
			) : (
				<TagCategoryBrowser key={`${cat}-${sort}`} cat={cat} sort={sort} />
			)}
		</section>
	);
}

function TagSearchResults({ q }: { q: string }) {
	const { data: searchTags } = useSuspenseQuery({
		queryKey: ["searchTags", q],
		queryFn: () => getSearchTags({ data: { q, limit: 200 } }),
		staleTime: 30_000,
	});

	const tagItems = searchTags?.hits ?? [];

	if (tagItems.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
				<TagsIcon className="size-12 mb-4 opacity-30" />
				<p className="text-lg">没有找到匹配的标签喵～</p>
				<p className="text-sm mt-1">试试其他关键词吧 🐾</p>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-2xl">
			<p className="text-center text-xs text-muted-foreground mb-3">
				共找到 {searchTags?.totalHits ?? tagItems.length} 个标签
			</p>
			<ul className="flex flex-col gap-1">
				{tagItems.map((hit) => (
					<li key={hit.id}>
						<Link
							to="/tags/$tagId"
							params={{ tagId: hit.id }}
							title={hit.zh_name || hit.name}
							className="flex items-baseline justify-between gap-3 px-3 py-2 rounded-lg no-underline hover:bg-muted/60 transition-colors"
						>
							<span className="font-medium text-foreground truncate">
								{hit.zh_name || hit.name}
							</span>
							<span
								className="text-xs text-muted-foreground shrink-0 truncate max-w-[45%]"
								title={`${hit.name}${hit.alias ? ` · ${hit.alias}` : ""}`}
							>
								{hit.name}
								{hit.alias ? ` · ${hit.alias}` : ""}
							</span>
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}

function TagCategoryBrowser({ cat, sort }: { cat: TagCat; sort: TagSort }) {
	const navigate = useNavigate();
	const { data: categories } = useSuspenseQuery({
		queryKey: ["tagCategories"],
		queryFn: async () =>
			(await getTagCategories()) ?? { cont: [], ero: [], tech: [] },
		staleTime: 5 * 60_000,
	});
	const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

	// 按分类筛选 + 排序（浏览量默认），仅取前 N 个避免一次性渲染上千个标签
	const visible = useMemo(() => {
		const src =
			cat === "all"
				? [...categories.cont, ...categories.ero, ...categories.tech]
				: (categories[cat] ?? []);
		const list = [...src];
		if (sort === "views") {
			list.sort((a, b) => b.views - a.views);
		} else if (sort === "nameAsc") {
			list.sort((a, b) => a.name.localeCompare(b.name, "zh"));
		} else {
			list.sort((a, b) => b.name.localeCompare(a.name, "zh"));
		}
		return list;
	}, [categories, cat, sort]);

	const shown = visible.slice(0, visibleCount);

	return (
		<div>
			<div className="flex flex-wrap items-center gap-2 mb-3">
				<List className="size-5 text-muted-foreground" />
				<Select
					value={cat}
					onValueChange={(v) =>
						navigate({
							to: "/tags",
							search: { cat: (v ?? "all") as TagCat, sort },
							replace: true,
						})
					}
				>
					<SelectTrigger className="w-28">
						<SelectValue>
							{(v) => CAT_LABEL[(v as TagCat) ?? "all"]}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">全部标签</SelectItem>
						<SelectItem value="cont">剧情</SelectItem>
						<SelectItem value="ero">性爱</SelectItem>
						<SelectItem value="tech">技术</SelectItem>
					</SelectContent>
				</Select>
				<Select
					value={sort}
					onValueChange={(v) =>
						navigate({
							to: "/tags",
							search: { cat, sort: (v ?? "views") as TagSort },
							replace: true,
						})
					}
				>
					<SelectTrigger className="w-28">
						<SelectValue>
							{(v) => SORT_LABEL[(v as TagSort) ?? "views"]}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="views">浏览量</SelectItem>
						<SelectItem value="nameAsc">名称正序</SelectItem>
						<SelectItem value="nameDesc">名称倒序</SelectItem>
					</SelectContent>
				</Select>
				{visible.length > 0 && (
					<span className="text-xs text-muted-foreground">
						共 {visible.length} 个标签
					</span>
				)}
			</div>

			{visible.length === 0 ? (
				<p className="text-center text-sm text-muted-foreground py-8">
					该分类暂无标签
				</p>
			) : (
				<>
					<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
						{shown.map((item) => (
							<Link
								key={item.id}
								to="/tags/$tagId"
								params={{ tagId: item.id }}
								title={item.name}
								className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2.5 no-underline transition-colors hover:bg-muted/60"
							>
								<span className="truncate text-sm font-medium text-foreground/90">
									{item.name}
								</span>
								{item.vnCount > 0 && (
									<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
										{item.vnCount}
									</span>
								)}
							</Link>
						))}
					</div>
					{visible.length > visibleCount && (
						<div className="mt-4 text-center">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setVisibleCount((c) => c + VISIBLE_STEP)}
							>
								显示更多（剩余 {visible.length - visibleCount} 个）
							</Button>
						</div>
					)}
				</>
			)}
		</div>
	);
}
