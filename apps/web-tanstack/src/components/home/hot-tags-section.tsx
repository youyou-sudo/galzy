import { Link } from "@tanstack/react-router";
import { Skeleton } from "@web/components/ui/skeleton";
import { useViewportPreload } from "@web/hooks/use-viewport-preload";
import { cn } from "@web/lib/utils";
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

const RANK_STYLES = [
	"border-red-500/50 text-red-500",
	"border-yellow-500/50 text-yellow-500",
	"border-blue-500/50 text-blue-500",
];

const BASE_CHIP =
	"inline-flex items-center gap-1 rounded-full border bg-card font-medium no-underline transition-colors hover:bg-accent hover:text-accent-foreground";

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
			className={cn(
				BASE_CHIP,
				RANK_STYLES[index] ?? "border-border text-foreground",
				className,
			)}
		>
			<span className="font-bold">{index + 1}</span>
			<span className="max-w-36 truncate">#{tag.title || tag.tag}</span>
		</Link>
	);
}

// 全端展示的热门标签，与下方本周热门板块对齐（根布局边距，无自身 padding）：
// - 标题行与本周热门头部同构：图标 size-5 + gap-2，标题文字左缘像素级对齐
// - 单行 chips 两端一致：横向滑动 + 右缘渐隐提示可滑动
export function HotTagsSection({ tags }: HotTagsSectionProps) {
	if (!tags || tags.length === 0) return null;

	return (
		<section className="mb-6 lg:mb-8">
			<div className="mb-2 flex items-center justify-between lg:mb-4">
				<div className="flex items-center gap-2">
					<Hash className="size-5 text-rose-400" />
					<h2 className="text-base font-semibold lg:text-xl">热门标签</h2>
				</div>
				<Link
					to="/tags"
					search={{ sort: "views" }}
					className="text-xs text-muted-foreground transition-colors hover:text-primary lg:text-sm"
				>
					更多 →
				</Link>
			</div>
			<ul className="flex gap-1.5 overflow-x-auto [mask-image:linear-gradient(to_right,black_82%,transparent_100%)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				{tags.slice(0, 12).map((tag, index) => (
					<li key={tag.tag} className="shrink-0">
						<TagChip
							tag={tag}
							index={index}
							className="px-2.5 py-1 text-xs lg:px-3 lg:py-1.5 lg:text-sm"
						/>
					</li>
				))}
			</ul>
		</section>
	);
}

export function HotTagsSectionSkeleton() {
	return (
		<div className="mb-6 lg:mb-8">
			<div className="mb-2 lg:mb-4">
				<Skeleton className="h-5 w-20 lg:h-6 lg:w-28" />
			</div>
			<div className="flex gap-1.5">
				<Skeleton className="h-6 w-16 rounded-full lg:h-8 lg:w-24" />
				<Skeleton className="h-6 w-24 rounded-full lg:h-8 lg:w-32" />
				<Skeleton className="h-6 w-14 rounded-full lg:h-8 lg:w-20" />
				<Skeleton className="h-6 w-20 rounded-full lg:h-8 lg:w-28" />
			</div>
		</div>
	);
}
