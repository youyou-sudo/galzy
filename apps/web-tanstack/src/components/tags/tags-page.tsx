import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { TagSortBar, tagMetricsTitle } from "@web/components/tags/tag-sort-bar";
import {
	TagTooltip,
	TagTooltipContent,
} from "@web/components/tags/tag-tooltip";
import { Skeleton } from "@web/components/ui/skeleton";
import { TooltipTrigger } from "@web/components/ui/tooltip";
import { cn } from "@web/lib/utils";
import type { TagHubCategory, TagOrderKey, TagSortKey } from "@web/server/tags";
import { getSearchTags, getTagHub } from "@web/server/tags";
import { tagHeroActions } from "@web/stores/tagHeroStore";
import {
	ArrowRightIcon,
	Loader2Icon,
	SearchIcon,
	TagsIcon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export type TagHit = {
	id: string;
	name: string;
	zh_name?: string;
	alias?: string;
};

type DebounceTimer = ReturnType<typeof setTimeout>;

export default function TagsIndexPage({
	q,
	sort,
	order,
}: {
	q: string | undefined;
	sort: TagSortKey;
	order: TagOrderKey;
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
				search: { ...(trimmed ? { q: trimmed } : {}), sort, order },
				replace: true,
				// 只是同页参数变化，不需要整页 View Transition 过渡
				viewTransition: false,
			});
		},
		[navigate, sort, order],
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
			search: { sort, order },
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
				<TagHubBrowser sort={sort} order={order} />
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
			aria-busy={isFetching}
			className={cn(
				"w-full transition-opacity duration-200",
				// 换关键词时旧结果保持可见但变暗、不可点，等新结果到达
				isFetching && "pointer-events-none opacity-60",
			)}
		>
			<p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
				共找到 {searchTags?.totalHits ?? tagItems.length} 个标签
				{isFetching && (
					<>
						<Loader2Icon className="size-3 animate-spin" />
						更新中…
					</>
				)}
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
							<TagTooltip>
								<TooltipTrigger
									render={
										<Link
											to="/tags/$tagId"
											params={{ tagId: hit.id }}
											// 点击时回写展示名，标签详情 pending 态复用。搜索结果来自
											// Meilisearch 的 Hit<RecordAny>，逐字段取值而不是整体传入，
											// 类型才收得住
											onClick={() =>
												tagHeroActions.fromTag({
													id: hit.id,
													zh_name: hit.zh_name,
													name: hit.name,
												})
											}
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
									}
								/>
								<TagTooltipContent>{tooltip}</TagTooltipContent>
							</TagTooltip>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

/** hub 每个分类块展示的预览条数，同时也是 hub 接口的 limit */
export const HUB_PREVIEW_LIMIT = 24;

/**
 * 标签库 hub：五个语义分类顺序平铺，每类标题 + 描述 + 分隔线 + 行式标签网格。
 * 视觉参考 dg.zi0.in/tags；网格用 auto-fill minmax(15rem) 自适应列数。
 */
function TagHubBrowser({
	sort,
	order,
}: {
	sort: TagSortKey;
	order: TagOrderKey;
}) {
	// 非 suspense：冷缓存进入（如从标签详情页点面包屑回列表）时，
	// 只让分类区域显示骨架，不把整页换成路由的 pendingComponent。
	// 数据优先命中路由 loader 的预取 / SSR 脱水结果。
	//
	// 排序依据 + 方向进 queryKey：接口在切片前排序，换任一维度都要重新取数
	//（不是二次排序已经在手的预览，那样得到的是「收录数前 N 条里的浏览次数
	// 榜」）。切换瞬间用 keepPreviousData 顶住，避免六个分类块一起闪骨架。
	const {
		data: hub,
		isPending,
		isFetching,
	} = useQuery({
		queryKey: ["tagHub", "preview", sort, order],
		queryFn: () =>
			getTagHub({ data: { limit: HUB_PREVIEW_LIMIT, sort, order } }),
		staleTime: 10 * 60_000,
		placeholderData: keepPreviousData,
	});

	if (isPending) {
		return <TagHubBrowserSkeleton />;
	}

	const categories = hub?.categories ?? [];

	return (
		<div className="flex flex-col gap-8">
			<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
				<p className="text-xs text-muted-foreground">
					共{" "}
					{categories
						.filter((c) => c.key !== "hot")
						.reduce((n, c) => n + c.tagCount, 0)}{" "}
					个标签
				</p>
				{/* 一处切换，下面所有分类块按同一口径排序 */}
				<TagSortBar scope="hub" value={sort} order={order} />
			</div>

			{categories.length === 0 ? (
				<p className="text-center text-sm text-muted-foreground py-8">
					暂无标签数据
				</p>
			) : (
				<div className="relative">
					{/* 换筛选时旧数据留在原位但变暗且不可点，避免点到已经作废的条目 */}
					<div
						aria-busy={isFetching}
						className={cn(
							"flex flex-col gap-8 transition-opacity duration-200",
							isFetching && "pointer-events-none opacity-40",
						)}
					>
						{categories.map((c) => (
							<TagHubSection
								key={c.key}
								category={c}
								sort={sort}
								order={order}
							/>
						))}
					</div>
					{isFetching && (
						<div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center">
							<Loader2Icon className="size-6 animate-spin text-muted-foreground" />
						</div>
					)}
				</div>
			)}
		</div>
	);
}

/**
 * hub 的单个分类块。标题区整块可点击 → 分类页，底部「查看全部」同样指向
 * 分类页，由那边列出该分类下的**全部**标签（依据 × 方向可再排）。
 *
 * 预览直接取接口给的前 N 条 —— 排序已在服务端切片之前完成，前端不再对预览
 * 二次排序（那只会得到「收录数前 N 条里再排」，与「站内前 N」不是一回事）。
 *
 * 原来这里是就地「展开其余 N 个标签」：hub 固定只返回 48 条预览，
 * 展开后永远显示「其余 24 个」，既对不上分类的真实规模（单个分类可超
 * 1000 个标签），也没有承接长列表的能力。
 */
function TagHubSection({
	category,
	sort,
	order,
}: {
	category: TagHubCategory;
	sort: TagSortKey;
	order: TagOrderKey;
}) {
	const tags = category.previewTags;
	const hasMore = category.tagCount > tags.length;
	// 热门标签是首页周榜的落点：不管在标签库按什么排序，进去都看「本周热门」，
	// 其余分类才把当前排序带过去
	const search: { sort: TagSortKey; order: TagOrderKey } =
		category.key === "hot"
			? { sort: "hotWeek", order: "desc" }
			: { sort, order };
	const categoryTo = {
		to: "/tags/category/$categoryKey" as const,
		params: { categoryKey: category.key },
		search,
	};

	return (
		<section>
			<Link
				{...categoryTo}
				className="group -mx-2 flex flex-col gap-1.5 rounded-md px-2 py-1.5 no-underline transition-colors hover:bg-muted/40"
			>
				<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					<h2 className="text-lg font-semibold transition-colors group-hover:text-primary">
						{category.name}
					</h2>
					<span className="text-xs text-muted-foreground tabular-nums">
						{category.tagCount}
					</span>
					<ArrowRightIcon className="size-3.5 self-center text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
				</div>
				{category.description && (
					<p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
						{category.description}
					</p>
				)}
			</Link>
			<div className="mt-2.5 border-t border-border/80" />

			{tags.length === 0 ? (
				<p className="mt-4 text-xs text-muted-foreground">该分类暂无标签</p>
			) : (
				<>
					<ul className="mt-4 grid grid-cols-2 gap-x-7 sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]">
						{tags.map((t) => {
							// 尾部固定显示收录游戏数（站内口径，与游戏列表一致）。
							// 换排序不改这一列，避免同一位置上的数字含义跟着漂移；
							// 浏览量放在 tooltip 里给。
							return (
								<li key={t.id} className="min-w-0">
									<TagTooltip>
										<TooltipTrigger
											render={
												<Link
													to="/tags/$tagId"
													params={{ tagId: t.id }}
													// 点击时回写展示名，标签详情 pending 态复用
													onClick={() => tagHeroActions.fromTag(t)}
													className="-mx-1.5 flex items-baseline gap-3 border-b border-border/70 px-1.5 py-[5px] text-xs leading-[18px] no-underline transition-colors hover:bg-muted/40"
												>
													<span className="min-w-0 flex-1 truncate">
														{t.name}
													</span>
													{t.vnCount > 0 && (
														<span className="shrink-0 font-mono tabular-nums text-muted-foreground/80">
															{t.vnCount}
														</span>
													)}
												</Link>
											}
										/>
										<TagTooltipContent>{tagMetricsTitle(t)}</TagTooltipContent>
									</TagTooltip>
								</li>
							);
						})}
					</ul>
					{hasMore && (
						<Link
							{...categoryTo}
							className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground no-underline transition-colors hover:text-foreground"
						>
							查看全部 {category.tagCount} 个标签
							<ArrowRightIcon className="size-3.5" />
						</Link>
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
