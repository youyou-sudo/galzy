import { Link } from "@tanstack/react-router";
import { TagSortBar, tagMetricsTitle } from "@web/components/tags/tag-sort-bar";
import {
	TagTooltip,
	TagTooltipContent,
} from "@web/components/tags/tag-tooltip";
import { Skeleton } from "@web/components/ui/skeleton";
import { TooltipTrigger } from "@web/components/ui/tooltip";
import { cn } from "@web/lib/utils";
import type {
	TagGroupCategory,
	TagHubTag,
	TagOrderKey,
	TagSortKey,
} from "@web/server/tags";
import { tagHeroActions } from "@web/stores/tagHeroStore";
import { Loader2Icon, TagsIcon } from "lucide-react";
import { memo, startTransition, useEffect, useMemo, useState } from "react";

/** 数值型排序依据的取值器（名称是唯一走字符串比较的依据，单独处理） */
const SORT_METRIC: Record<
	Exclude<TagSortKey, "name">,
	(t: TagHubTag) => number
> = {
	count: (t) => t.vnCount,
	views: (t) => t.views,
	hotWeek: (t) => t.viewsWeek,
	hotMonth: (t) => t.viewsMonth,
};

/**
 * 分类页排序。收录数 + 倒序直接用接口顺序（已按收录数降序 + 中文名升序稳定
 * 排序），其余组合在前端排 —— 整份列表本来就在手上，切换排序不该再打一次
 * 接口。口径与 API 的 hub 排序完全一致（方向只翻转主键，并列时回落规范次序：
 * 收录数降序 + 中文名升序），否则同一个组合在两个页面会给出不同结果。
 */
function sortTags(tags: TagHubTag[], sort: TagSortKey, order: TagOrderKey) {
	if (sort === "count" && order === "desc") return tags;

	const dir = order === "asc" ? 1 : -1;
	if (sort === "name") {
		return [...tags].sort(
			(a, b) =>
				dir * a.name.localeCompare(b.name, "zh") || b.vnCount - a.vnCount,
		);
	}
	const metric = SORT_METRIC[sort];
	return [...tags].sort(
		(a, b) =>
			dir * (metric(a) - metric(b)) ||
			b.vnCount - a.vnCount ||
			a.name.localeCompare(b.name, "zh"),
	);
}

/**
 * 切换筛选取到新顺序之前，「加载中」最少停留的时长。
 *
 * 分类页的排序是同步的（全量列表已在手，不发请求），不刻意停一下的话变暗 +
 * 转圈会跟新顺序在同一次提交里完成，用户什么都看不到；顺带也把「排序 + 上千
 * 行重排」这笔开销从点击路径上挪走。200ms 低于「卡顿」感知阈值。
 */
const SORT_FEEDBACK_MS = 200;

/**
 * 标签库分类页：列出某个分类下的**全部**标签。
 *
 * hub 每个分类块只预览 24 条，点标题或「查看全部」进到这里；标签量与分类
 * 真实规模一致（热门/语义分类/降级 cont 都可能有上千条），因此这里不做截断。
 */
export default function TagCategoryPage({
	category,
	sort,
	order,
}: {
	category: TagGroupCategory | null;
	sort: TagSortKey;
	order: TagOrderKey;
}) {
	if (!category) return <CategoryNotFound />;

	return <CategoryTagList category={category} sort={sort} order={order} />;
}

function CategoryNotFound() {
	return (
		<div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
			<TagsIcon className="mb-4 size-12 opacity-30" />
			<p className="text-lg">分类不存在</p>
			<Link
				to="/tags"
				className="mt-3 text-sm text-primary no-underline hover:underline"
			>
				返回标签库
			</Link>
		</div>
	);
}

function CategoryTagList({
	category,
	sort,
	order,
}: {
	category: TagGroupCategory;
	sort: TagSortKey;
	order: TagOrderKey;
}) {
	const sortKey = `${sort}|${order}`;
	/**
	 * 已落板的排序结果 + 它对应的分类与排序参数。
	 *
	 * 这里刻意不把「目标顺序」算在上面的 render 里：分类页一次要排上千行，
	 * 排序 + 上千个 li 的重渲染会顶在主线程上，点击到变暗之间就会空一拍
	 * （用户看到的「顿一下」）。改成下面这套：目标参数一变，当次 render 就
	 * 是加载态，排序本身等这道反馈动画走完再算。
	 */
	const [committed, setCommitted] = useState(() => ({
		categoryKey: category.key,
		sortKey,
		tags: sortTags(category.tags, sort, order),
	}));

	// 换分类 = 翻页：旧分类的列表立刻作废（当次 render 就按新分类算），
	// 路由那边有自己的骨架兜底，不插这段反馈动画
	const categoryChanged = committed.categoryKey !== category.key;
	const tags = categoryChanged
		? sortTags(category.tags, sort, order)
		: committed.tags;
	// 换排序：旧顺序原样留着变暗 + 转圈，到点再换新顺序
	const isSorting = !categoryChanged && committed.sortKey !== sortKey;

	useEffect(() => {
		if (categoryChanged) {
			setCommitted({
				categoryKey: category.key,
				sortKey,
				tags: sortTags(category.tags, sort, order),
			});
			return;
		}
		if (!isSorting) return;

		let cancelled = false;
		// 变暗的那一帧已经在上面 render 时提交，这里只负责「排序 + 落板」，
		// 不再同步算在主线程的点击路径上 —— 否则就是点击后先顿一下再出动画。
		const timer = setTimeout(() => {
			if (cancelled) return;
			const nextTags = sortTags(category.tags, sort, order);
			// 上千行的重排走 transition：渲染可被打断，主线程不会被一次性占满
			startTransition(() =>
				setCommitted({ categoryKey: category.key, sortKey, tags: nextTags }),
			);
		}, SORT_FEEDBACK_MS);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [
		categoryChanged,
		isSorting,
		category.key,
		category.tags,
		sort,
		order,
		sortKey,
	]);

	/**
	 * 列表项只在数据真的换了之后重建：切换期间只有 ul 的 className 变，
	 * 不必把上千个 li 重新构造一遍；每行再用 TagRow 的 memo 挡住重渲染。
	 */
	const items = useMemo(
		() => tags.map((t) => <TagRow key={t.id} tag={t} />),
		[tags],
	);

	return (
		<section className="flex flex-col gap-2">
			<div className="flex flex-col gap-1.5">
				<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					<div className="flex items-center gap-2">
						<TagsIcon className="size-5 text-primary" />
						<h1 className="text-2xl font-semibold">{category.name}</h1>
					</div>
					<span className="text-sm text-muted-foreground tabular-nums">
						{category.tagCount} 个标签
					</span>
				</div>
				{category.description && (
					<p className="text-sm text-muted-foreground">
						{category.description}
					</p>
				)}
			</div>

			<TagSortBar
				scope="category"
				categoryKey={category.key}
				value={sort}
				order={order}
			/>

			{tags.length === 0 ? (
				<p className="py-8 text-center text-sm text-muted-foreground">
					该分类暂无标签
				</p>
			) : (
				<div className="relative">
					<ul
						aria-busy={isSorting}
						className={cn(
							"mt-2 grid grid-cols-2 gap-x-7 transition-opacity duration-200 sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]",
							// 换筛选时旧顺序留在原位但变暗、不可点
							isSorting && "pointer-events-none opacity-40",
						)}
					>
						{items}
					</ul>
					{isSorting && (
						<div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center">
							<Loader2Icon className="size-6 animate-spin text-muted-foreground" />
						</div>
					)}
				</div>
			)}
		</section>
	);
}

/**
 * 分类页的一行标签。
 *
 * memo 是刻意加的：一次切换要动上千行，逐行重渲染（每行还挂着 tooltip
 * 上下文）是这里最大的一笔开销；换排序时每行的 props（tag 对象）都没变，
 * 整行跳过，React 只需要重排已有的 DOM 节点。
 */
const TagRow = memo(function TagRow({ tag }: { tag: TagHubTag }) {
	// 尾部固定显示收录游戏数（见 tags-page 的同名说明）
	return (
		<li className="min-w-0">
			<TagTooltip>
				<TooltipTrigger
					render={
						<Link
							to="/tags/$tagId"
							params={{ tagId: tag.id }}
							// 点击时回写展示名，标签详情 pending 态复用
							onClick={() => tagHeroActions.fromTag(tag)}
							className="-mx-1.5 flex items-baseline gap-3 border-b border-border/70 px-1.5 py-[5px] text-xs leading-[18px] no-underline transition-colors hover:bg-muted/40"
						>
							<span className="min-w-0 flex-1 truncate">{tag.name}</span>
							{tag.vnCount > 0 && (
								<span className="shrink-0 font-mono tabular-nums text-muted-foreground/80">
									{tag.vnCount}
								</span>
							)}
						</Link>
					}
				/>
				<TagTooltipContent>{tagMetricsTitle(tag)}</TagTooltipContent>
			</TagTooltip>
		</li>
	);
});

export function TagCategoryPageSkeleton() {
	return (
		<div className="flex flex-col gap-4" aria-hidden>
			<Skeleton className="h-8 w-40" />
			<Skeleton className="h-4 w-2/3 max-w-xl" />
			<div className="grid grid-cols-2 gap-x-7 gap-y-[9px] sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]">
				{Array.from({ length: 24 }, (_, i) => (
					<Skeleton key={i} className="h-4 w-full" />
				))}
			</div>
		</div>
	);
}
