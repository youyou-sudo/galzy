import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Skeleton } from "@web/components/ui/skeleton";
import { cn } from "@web/lib/utils";
import type { TagHubCategory } from "@web/server/tags";
import { getSearchTags, getTagHub } from "@web/server/tags";
import { SearchIcon, TagsIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export type TagHit = {
	id: string;
	name: string;
	zh_name?: string;
	alias?: string;
};

export type TagSort = "nameAsc" | "nameDesc";

type DebounceTimer = ReturnType<typeof setTimeout>;

export default function TagsIndexPage({
	q,
	sort,
}: {
	q: string | undefined;
	sort: TagSort;
}) {
	const navigate = useNavigate();
	const [inputValue, setInputValue] = useState(q || "");
	const debounceRef = useRef<DebounceTimer>(null);
	// 当前 URL 里的关键词：输入未变化时跳过导航，避免同值 search 变化
	// 触发一次无意义的路由导航（连带 loader 重跑）
	const queryRef = useRef(q?.trim() ?? "");

	useEffect(() => {
		queryRef.current = q?.trim() ?? "";
	}, [q]);

	const handleSearch = useCallback(
		(value: string) => {
			const trimmed = value.trim();
			if (trimmed === queryRef.current) return;
			navigate({
				to: "/tags",
				search: { ...(trimmed ? { q: trimmed } : {}), sort },
				replace: true,
				// 只是同页参数变化，不需要整页 View Transition 过渡
				viewTransition: false,
			});
		},
		[navigate, sort],
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
		navigate({
			to: "/tags",
			search: { sort },
			replace: true,
			viewTransition: false,
		});
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
	// 仅在内容（忽略首尾空格）真的不同时回写，避免输入过程中的回声覆盖
	useEffect(() => {
		setInputValue((prev) =>
			prev.trim() === (q ?? "").trim() ? prev : q || "",
		);
	}, [q]);

	const searchQ = q?.trim();

	return (
		<section className="flex flex-col gap-2">
			<div className="flex flex-col gap-1.5">
				<div className="flex items-center gap-2">
					<TagsIcon className="size-5 text-primary" />
					<h1 className="text-2xl font-semibold">标签库</h1>
				</div>
				<p className="text-sm text-muted-foreground">
					浏览、搜索与发现游戏标签
				</p>
			</div>

			<div className="md:w-1/2">
				<div className="relative">
					<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
					<input
						type="text"
						value={inputValue}
						onChange={handleInputChange}
						onKeyDown={handleKeyDown}
						placeholder="搜索标签名称（中文 / 英文 / 别名）…"
						className="h-9 w-full rounded-md bg-muted/60 pl-9 pr-8 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
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
				<TagHubBrowser key={sort} sort={sort} />
			)}
		</section>
	);
}

function TagSearchResults({ q }: { q: string }) {
	// 非 suspense：换关键词时留旧结果占位（keepPreviousData），
	// 只在局部显示加载态，避免整块结果区闪骨架
	const {
		data: searchTags,
		isPending,
		isFetching,
	} = useQuery({
		queryKey: ["searchTags", q],
		queryFn: () => getSearchTags({ data: { q, limit: 200 } }),
		staleTime: 30_000,
		placeholderData: keepPreviousData,
	});

	const tagItems = searchTags?.hits ?? [];

	if (isPending) {
		return (
			<div className="w-full">
				<p className="text-xs text-muted-foreground mb-3">搜索中…</p>
				<ul className="grid grid-cols-2 gap-x-7 sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]">
					{Array.from({ length: 12 }, (_, i) => (
						<li key={i} className="min-w-0 py-[5px]">
							<Skeleton className="h-4 w-full" />
						</li>
					))}
				</ul>
			</div>
		);
	}

	if (tagItems.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
				<TagsIcon className="size-12 mb-4 opacity-30" />
				<p className="text-lg">没有找到匹配的标签</p>
				<p className="text-sm mt-1">试试其他关键词吧</p>
			</div>
		);
	}

	return (
		<div
			className={cn("w-full transition-opacity", isFetching && "opacity-60")}
		>
			<p className="text-xs text-muted-foreground mb-3">
				共找到 {searchTags?.totalHits ?? tagItems.length} 个标签
				{isFetching && "（更新中…）"}
			</p>
			<ul className="grid grid-cols-2 gap-x-7 sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]">
				{tagItems.map((hit) => {
					const zhName = hit.zh_name?.trim();
					const enName = hit.name?.trim() ?? "";
					// 中文优先：没有中文名时只展示一次原文，避免同名重复渲染
					const primary = zhName || enName || hit.id;
					const tooltip = [primary, enName, hit.alias?.trim()]
						.filter(Boolean)
						.filter((v, i, arr) => arr.indexOf(v) === i)
						.join(" · ");
					return (
						<li key={hit.id} className="min-w-0">
							<Link
								to="/tags/$tagId"
								params={{ tagId: hit.id }}
								title={tooltip}
								className="-mx-1.5 flex items-baseline gap-3 border-b border-border/70 px-1.5 py-[5px] text-xs leading-[18px] no-underline transition-colors hover:bg-muted/40"
							>
								{/* 中文名压住英文名：最多占 7 成宽度，超出才截断 */}
								<span className="min-w-0 max-w-[70%] shrink-0 truncate font-medium">
									{primary}
								</span>
								{zhName && enName && (
									<span className="min-w-0 flex-1 truncate text-right text-muted-foreground/80">
										{enName}
									</span>
								)}
							</Link>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

/**
 * 标签库 hub：五个语义分类顺序平铺，每类标题 + 描述 + 分隔线 + 行式标签网格。
 * 视觉参考 dg.zi0.in/tags；网格用 auto-fill minmax(15rem) 自适应列数。
 */
function TagHubBrowser({ sort }: { sort: TagSort }) {
	// 非 suspense：冷缓存进入（如从标签详情页点面包屑回列表）时，
	// 只让分类区域显示骨架，不把整页换成路由的 pendingComponent。
	// 数据优先命中路由 loader 的预取 / SSR 脱水结果。
	const { data: hub, isPending } = useQuery({
		queryKey: ["tagHub", "preview"],
		queryFn: () => getTagHub({ data: { limit: 48 } }),
		staleTime: 10 * 60_000,
	});

	if (isPending) {
		return <TagHubBrowserSkeleton />;
	}

	const categories = hub?.categories ?? [];

	return (
		<div className="flex flex-col gap-8">
			<div className="flex items-center gap-3">
				<p className="text-xs text-muted-foreground">
					共{" "}
					{categories
						.filter((c) => c.key !== "hot")
						.reduce((n, c) => n + c.tagCount, 0)}{" "}
					个标签
				</p>
			</div>

			{categories.length === 0 ? (
				<p className="text-center text-sm text-muted-foreground py-8">
					暂无标签数据
				</p>
			) : (
				categories.map((c) => (
					<TagHubSection key={c.key} category={c} sort={sort} />
				))
			)}
		</div>
	);
}

function TagHubSection({
	category,
	sort,
}: {
	category: TagHubCategory;
	sort: TagSort;
}) {
	const [expanded, setExpanded] = useState(false);

	// hub 接口按收录数降序返回（参考站口径）；排序切换在前端做，避免多打一次接口。
	// 「热门标签」是横切分类，按收录数排序才有意义（浏览量已从排序项移除），
	// 所以这一类忽略名称排序，保持接口给出的热度顺序。
	const tags = [...category.previewTags].sort((a, b) => {
		if (category.key === "hot") return b.vnCount - a.vnCount;
		if (sort === "nameAsc") return a.name.localeCompare(b.name, "zh");
		if (sort === "nameDesc") return b.name.localeCompare(a.name, "zh");
		return b.vnCount - a.vnCount;
	});

	const shown = expanded ? tags : tags.slice(0, 24);
	const hidden = tags.length - 24;

	return (
		<section>
			<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<h2 className="text-lg font-semibold">{category.name}</h2>
				<span className="text-xs text-muted-foreground tabular-nums">
					{category.tagCount}
				</span>
			</div>
			{category.description && (
				<p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
					{category.description}
				</p>
			)}
			<div className="mt-4 border-t border-border/80" />

			{tags.length === 0 ? (
				<p className="mt-4 text-xs text-muted-foreground">该分类暂无标签</p>
			) : (
				<>
					<ul className="mt-4 grid grid-cols-2 gap-x-7 sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]">
						{shown.map((t) => (
							<li key={t.id} className="min-w-0">
								<Link
									to="/tags/$tagId"
									params={{ tagId: t.id }}
									title={t.name}
									className="-mx-1.5 flex items-baseline gap-3 border-b border-border/70 px-1.5 py-[5px] text-xs leading-[18px] no-underline transition-colors hover:bg-muted/40"
								>
									<span className="min-w-0 flex-1 truncate">{t.name}</span>
									{t.vnCount > 0 && (
										<span className="shrink-0 font-mono tabular-nums text-muted-foreground/80">
											{t.vnCount}
										</span>
									)}
								</Link>
							</li>
						))}
					</ul>
					{hidden > 0 && (
						<button
							type="button"
							onClick={() => setExpanded((v) => !v)}
							aria-expanded={expanded}
							className="mt-3 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
						>
							{expanded
								? `收起其余 ${hidden} 个标签`
								: `展开其余 ${hidden} 个标签`}
						</button>
					)}
				</>
			)}
		</section>
	);
}

function TagHubCategoriesSkeleton() {
	return (
		<>
			{[0, 1, 2].map((i) => (
				<div key={i} className="flex flex-col gap-3">
					<Skeleton className="h-6 w-40" />
					<Skeleton className="h-3 w-56" />
					<div className="mt-1 border-t border-border/80" />
					<div className="grid grid-cols-2 gap-x-7 sm:grid-cols-3">
						{Array.from({ length: 12 }, (_, k) => (
							<Skeleton key={k} className="h-4 w-full" />
						))}
					</div>
				</div>
			))}
		</>
	);
}

/** 标签库内容区骨架：标题/搜索框已渲染时用它，避免整页骨架闪烁 */
function TagHubBrowserSkeleton() {
	return (
		<div className="flex flex-col gap-8">
			<Skeleton className="h-3 w-24" />
			<TagHubCategoriesSkeleton />
		</div>
	);
}

export function TagsHubSkeleton() {
	return (
		<div className="flex flex-col gap-8">
			<Skeleton className="h-8 w-32" />
			<Skeleton className="h-9 w-full md:w-1/2" />
			<TagHubCategoriesSkeleton />
		</div>
	);
}
