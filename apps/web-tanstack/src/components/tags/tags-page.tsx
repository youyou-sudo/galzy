import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { EmptyState } from "@web/components/shared/empty-state";
import { PageHeader } from "@web/components/shared/page-header";
import {
	SectionHeader,
	sectionActionClass,
} from "@web/components/shared/section-header";
import { SearchField } from "@web/components/shared/search-field";
import { TagSortBar, tagMetricsTitle } from "@web/components/tags/tag-sort-bar";
import {
	TagTooltip,
	TagTooltipContent,
} from "@web/components/tags/tag-tooltip";
import { Button } from "@web/components/ui/button";
import { Skeleton } from "@web/components/ui/skeleton";
import { TooltipTrigger } from "@web/components/ui/tooltip";
import { cn } from "@web/lib/utils";
import type { TagHubCategory, TagOrderKey, TagSortKey } from "@web/server/tags";
import { getSearchTags, getTagHub } from "@web/server/tags";
import { tagHeroActions } from "@web/stores/tagHeroStore";
import { ArrowRightIcon, Loader2Icon, TagsIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export type TagHit = {
	id: string;
	name: string;
	zh_name?: string;
	alias?: string;
};

type DebounceTimer = ReturnType<typeof setTimeout>;

/** 行式标签的公共类：保持高密度（不卡片化），hover 只提亮底色 */
const tagRowClass =
	"flex gap-3 items-baseline px-1.5 py-[5px] -mx-1.5 text-xs leading-[18px] no-underline rounded-sm border-b border-border/70 transition-colors duration-200 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60";

/**
 * 标签库入口页：PageHeader + SearchField +（搜索结果 | 分类 hub）。
 * 防抖、URL 同步、keepPreviousData 等原有逻辑保持不变。
 */
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
			// 回车提交时取消尚未触发的防抖导航，避免同值导航跑两次
			clearTimeout(debounceRef.current ?? undefined);
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

	const handleInputChange = (value: string) => {
		setInputValue(value);
		clearTimeout(debounceRef.current ?? undefined);
		debounceRef.current = setTimeout(() => {
			handleSearch(value);
		}, 300);
	};

	const handleClear = () => {
		clearTimeout(debounceRef.current ?? undefined);
		setInputValue("");
		navigate({
			to: "/tags",
			search: { sort, order },
			replace: true,
			viewTransition: false,
		});
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
		<section>
			<PageHeader
				icon={TagsIcon}
				title="标签库"
				description="浏览、搜索与发现游戏标签"
			/>

			<div className="mb-6 w-full sm:max-w-md">
				<SearchField
					value={inputValue}
					onChange={handleInputChange}
					onSubmit={handleSearch}
					onClear={handleClear}
					placeholder="搜索标签名称（中文 / 英文 / 别名）…"
					ariaLabel="搜索标签"
				/>
			</div>

			{searchQ ? (
				<TagSearchResults q={searchQ} onClearSearch={handleClear} />
			) : (
				<TagHubBrowser sort={sort} order={order} />
			)}
		</section>
	);
}

function TagSearchResults({
	q,
	onClearSearch,
}: {
	q: string;
	onClearSearch: () => void;
}) {
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
				<p className="mb-3 text-xs text-muted-foreground">搜索中…</p>
				<ul className="grid grid-cols-2 gap-x-7 sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]">
					{Array.from({ length: 12 }, (_, i) => (
						<li key={i} className="py-[5px] min-w-0">
							<Skeleton className="w-full h-4" />
						</li>
					))}
				</ul>
			</div>
		);
	}

	if (tagItems.length === 0) {
		return (
			<EmptyState
				icon={TagsIcon}
				title="没有找到匹配的标签"
				description="试试其他关键词，或清空搜索浏览全部标签"
				action={
					<Button variant="outline" size="sm" onClick={onClearSearch}>
						清空搜索
					</Button>
				}
			/>
		);
	}

	return (
		<div
			aria-busy={isFetching}
			className={cn(
				"w-full transition-opacity duration-200",
				// 换关键词时旧结果保持可见但变暗、不可点，等新结果到达
				isFetching && "opacity-60 pointer-events-none",
			)}
		>
			<p className="flex gap-1.5 items-center mb-3 text-xs tabular-nums text-muted-foreground">
				共找到 {searchTags?.totalHits ?? tagItems.length} 个标签
				{isFetching && (
					<>
						<Loader2Icon aria-hidden="true" className="size-3 animate-spin" />
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
											className={tagRowClass}
										>
											{/* 中文名压住英文名：最多占 7 成宽度，超出才截断 */}
											<span className="shrink-0 min-w-0 max-w-[70%] font-medium truncate">
												{primary}
											</span>
											{zhName && enName && (
												<span className="flex-1 min-w-0 text-right text-muted-foreground/80 truncate">
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
	const totalTagCount = categories
		.filter((c) => c.key !== "hot")
		.reduce((n, c) => n + c.tagCount, 0);

	return (
		<div className="flex flex-col gap-8">
			<div className="flex flex-wrap gap-x-4 gap-y-2 justify-between items-center px-3 py-2 bg-muted/40 rounded-2xl ring-1 ring-border/60">
				<p className="text-sm tabular-nums text-muted-foreground">
					共 {totalTagCount} 个标签
				</p>
				{/* 一处切换，下面所有分类块按同一口径排序 */}
				<TagSortBar scope="hub" value={sort} order={order} />
			</div>

			{categories.length === 0 ? (
				<EmptyState
					icon={TagsIcon}
					title="暂无标签数据"
					description="标签数据正在同步，稍后再来看看吧"
					size="sm"
				/>
			) : (
				<div className="relative">
					{/* 换筛选时旧数据留在原位但变暗且不可点，避免点到已经作废的条目 */}
					<div
						aria-busy={isFetching}
						className={cn(
							"flex flex-col gap-8 transition-opacity duration-200",
							isFetching && "opacity-40 pointer-events-none",
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
						<div className="flex absolute inset-x-0 top-16 justify-center pointer-events-none">
							<Loader2Icon className="size-6 text-muted-foreground animate-spin" />
						</div>
					)}
				</div>
			)}
		</div>
	);
}

/**
 * hub 的单个分类块。标题行用 SectionHeader（标题可点 → 分类页，「查看全部」
 * 走 sectionActionClass），底部列出该分类的前 N 条预览。
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
			<SectionHeader
				title={
					<Link
						{...categoryTo}
						className="rounded-sm transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
					>
						{category.name}
					</Link>
				}
				count={category.tagCount}
				action={
					hasMore ? (
						<Link {...categoryTo} className={sectionActionClass}>
							查看全部 {category.tagCount} 个标签
							<ArrowRightIcon aria-hidden="true" className="size-3.5" />
						</Link>
					) : undefined
				}
				className="mb-2"
			/>
			{category.description && (
				<p className="mb-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
					{category.description}
				</p>
			)}
			<div className="mt-2 border-t border-border/80" />

			{tags.length === 0 ? (
				<EmptyState
					icon={TagsIcon}
					title="该分类暂无标签"
					size="sm"
					className="py-8"
				/>
			) : (
				<ul className="grid grid-cols-2 gap-x-7 mt-4 sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]">
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
												className={tagRowClass}
											>
												<span className="flex-1 min-w-0 truncate">
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
			)}
		</section>
	);
}

function TagHubCategoriesSkeleton() {
	return (
		<>
			{[0, 1, 2].map((i) => (
				<div key={i} className="flex flex-col gap-3">
					<Skeleton className="w-40 h-6" />
					<Skeleton className="w-56 h-3" />
					<div className="mt-1 border-t border-border/80" />
					<div className="grid grid-cols-2 gap-x-7 sm:grid-cols-3">
						{Array.from({ length: 12 }, (_, k) => (
							<Skeleton key={k} className="w-full h-4" />
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
			<div className="flex flex-wrap gap-3 justify-between items-center px-3 py-2 bg-muted/40 rounded-2xl ring-1 ring-border/60">
				<Skeleton className="w-24 h-4" />
				<Skeleton className="w-48 h-8" />
			</div>
			<TagHubCategoriesSkeleton />
		</div>
	);
}

/** 路由 pending：页头/搜索框外壳是真实内容，只有分类区出骨架 */
export function TagsHubSkeleton() {
	return (
		<section>
			<PageHeader
				icon={TagsIcon}
				title="标签库"
				description="浏览、搜索与发现游戏标签"
			/>
			<div className="mb-6 w-full sm:max-w-md">
				<Skeleton className="w-full h-9 rounded-xl" />
			</div>
			<TagHubBrowserSkeleton />
		</section>
	);
}
