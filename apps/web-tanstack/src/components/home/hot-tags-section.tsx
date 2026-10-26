import { Link } from "@tanstack/react-router";
import {
	SectionHeader,
	sectionActionClass,
} from "@web/components/shared/section-header";
import { Skeleton } from "@web/components/ui/skeleton";
import { useViewportPreload } from "@web/hooks/use-viewport-preload";
import { cn } from "@web/lib/utils";
import { tagHeroActions } from "@web/stores/tagHeroStore";
import { Hash } from "lucide-react";
import { useRef } from "react";

interface HotTag {
	tag: string;
	title: string | null;
	total: number;
}

interface HotTagsSectionProps {
	tags: HotTag[] | null;
}

/**
 * 排名只看前三：圆角数字底片从灰变成主色淡底，不再用红/黄/蓝三色拼盘。
 * 颜色只做「层级提示」，不承担语义（热度本身由排序表达）。
 */
const BASE_CHIP =
	"inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-2.5 py-1 text-xs font-medium no-underline transition-colors duration-200 hover:border-border hover:bg-muted/60 hover:text-foreground";

const rankClass = (index: number) =>
	index < 3 ? "border-primary/25 bg-primary/5" : "";

const rankNumberClass = (index: number) =>
	index < 3
		? "bg-primary/10 text-primary"
		: "bg-muted text-muted-foreground";

function TagChip({
	tag,
	index,
	className,
}: {
	tag: HotTag;
	index: number;
	className?: string;
}) {
	const linkRef = useRef<HTMLAnchorElement>(null);
	// 进入视口即预取标签详情数据，未请求过的条目点击也秒开（不触发 view 计数）
	useViewportPreload(
		linkRef,
		(router) => () =>
			router.preloadRoute({ to: "/tags/$tagId", params: { tagId: tag.tag } }),
	);

	return (
		<Link
			ref={linkRef}
			to="/tags/$tagId"
			params={{ tagId: tag.tag }}
			// 点击时回写展示名，标签详情 pending 态复用；榜单没有中文标题时用
			// 榜单上展示的 id 兜底，和用户刚看到的文案保持一致
			onClick={() =>
				tagHeroActions.fromTag({ id: tag.tag, name: tag.title || tag.tag })
			}
			className={cn(BASE_CHIP, rankClass(index), className)}
		>
			<span
				className={cn(
					"flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
					rankNumberClass(index),
				)}
			>
				{index + 1}
			</span>
			<span className="max-w-36 truncate">#{tag.title || tag.tag}</span>
		</Link>
	);
}

/**
 * 热门标签区块的标题行（图标 + 「热门标签」+「更多 →」）。
 *
 * 真实区块与 pending 骨架共用，保证 pending 期间标题行已是真实 HTML，
 * 数据到达时只有下方药丸内容被替换。
 */
export function HotTagsSectionHeader() {
	return (
		<SectionHeader
			icon={Hash}
			title="热门标签"
			className="mb-3 lg:mb-4"
			action={
				<Link
					// 首页这块展示的就是「本周热门」标签，所以「更多」落到热门分类页的
					// 本周热门排序上，翻页时榜单顺序不断层（分类页可再切本月/收录数）
					to="/tags/category/$categoryKey"
					params={{ categoryKey: "hot" }}
					search={{ sort: "hotWeek", order: "desc" }}
					className={sectionActionClass}
				>
					更多 →
				</Link>
			}
		/>
	);
}

// 全端展示的热门标签，与下方本周热门板块对齐（根布局边距，无自身 padding）：
// - 标题行与本周热门头部同构：图标 size-5 + gap-2，标题文字左缘像素级对齐
// - 单行 chips 两端一致：横向滑动 + 右缘渐隐提示可滑动
export function HotTagsSection({ tags }: HotTagsSectionProps) {
	if (!tags || tags.length === 0) return null;

	return (
		<section className="mb-6 lg:mb-8">
			<HotTagsSectionHeader />
			<ul className="galzy-scroll-x galzy-fade-x flex gap-2">
				{tags.slice(0, 12).map((tag, index) => (
					<li key={tag.tag} className="shrink-0">
						<TagChip
							tag={tag}
							index={index}
							className="lg:px-3 lg:py-1.5 lg:text-sm"
						/>
					</li>
				))}
			</ul>
		</section>
	);
}

// pending 期间外壳固定：标题行与「更多 →」是真实 HTML，只有药丸内容出加载态
export function HotTagsSectionSkeleton() {
	return (
		<section className="mb-6 lg:mb-8">
			<HotTagsSectionHeader />
			<div className="flex gap-1.5" aria-hidden>
				<Skeleton className="h-6 w-16 rounded-full lg:h-8 lg:w-24" />
				<Skeleton className="h-6 w-24 rounded-full lg:h-8 lg:w-32" />
				<Skeleton className="h-6 w-14 rounded-full lg:h-8 lg:w-20" />
				<Skeleton className="h-6 w-20 rounded-full lg:h-8 lg:w-28" />
			</div>
		</section>
	);
}
