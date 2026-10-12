import { Link } from "@tanstack/react-router";
import { TagSortBar, tagMetricsTitle } from "@web/components/tags/tag-sort-bar";
import {
	TagTooltip,
	TagTooltipContent,
} from "@web/components/tags/tag-tooltip";
import { Skeleton } from "@web/components/ui/skeleton";
import { TooltipTrigger } from "@web/components/ui/tooltip";
import type { TagGroupCategory, TagHubTag, TagSortKey } from "@web/server/tags";
import { TagsIcon } from "lucide-react";

/**
 * 分类页排序。count 直接用接口顺序（已按收录数降序 + 中文名升序稳定排序）；
 * 其余键在前端排 —— 整份列表本来就在手上，切换排序不该再打一次接口。
 * 口径与 API 的 hub 排序保持一致（views 并列时回落收录数），
 * 否则同一个「按浏览次数排」在两个页面会给出不同结果。
 */
function sortTags(tags: TagHubTag[], sort: TagSortKey) {
	if (sort === "views")
		return [...tags].sort(
			(a, b) =>
				b.views - a.views ||
				b.vnCount - a.vnCount ||
				a.name.localeCompare(b.name, "zh"),
		);
	if (sort === "nameAsc")
		return [...tags].sort((a, b) => a.name.localeCompare(b.name, "zh"));
	if (sort === "nameDesc")
		return [...tags].sort((a, b) => b.name.localeCompare(a.name, "zh"));
	return tags;
}

/**
 * 标签库分类页：列出某个分类下的**全部**标签。
 *
 * hub 每个分类块只预览 24 条，点标题或「查看全部」进到这里；标签量与分类
 * 真实规模一致（热门/语义分类/降级 cont 都可能有上千条），因此这里不做截断。
 */
export default function TagCategoryPage({
	category,
	sort,
}: {
	category: TagGroupCategory | null;
	sort: TagSortKey;
}) {
	if (!category) {
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

	const tags = sortTags(category.tags, sort);

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

			<TagSortBar scope="category" categoryKey={category.key} value={sort} />

			{tags.length === 0 ? (
				<p className="py-8 text-center text-sm text-muted-foreground">
					该分类暂无标签
				</p>
			) : (
				<ul className="mt-2 grid grid-cols-2 gap-x-7 sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]">
					{tags.map((t) => {
						// 尾部固定显示收录游戏数（见 tags-page 的同名说明）
						return (
							<li key={t.id} className="min-w-0">
								<TagTooltip>
									<TooltipTrigger
										render={
											<Link
												to="/tags/$tagId"
												params={{ tagId: t.id }}
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
			)}
		</section>
	);
}

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
