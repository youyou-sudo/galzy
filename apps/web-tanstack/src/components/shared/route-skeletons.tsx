import { useSelector } from "@tanstack/react-store";
import { CommentThreadSkeleton } from "@web/components/cmments/comment-skeleton";
import { GameCardGridSkeleton } from "@web/components/game/game-card-grid-skeleton";
import { GameTabSkeleton } from "@web/components/game/game-tab-skeleton";
import { GameCard } from "@web/components/home/card";
import { Skeleton } from "@web/components/ui/skeleton";
import { producerHeroStore } from "@web/stores/producerHeroStore";

export { GameCardGridSkeleton };

/**
 * 路由 pendingComponent 骨架屏集合。
 * 点击瞬间（defaultPendingMs=0）即渲染，快速点击时旧页面不再冻结等待，
 * 先出骨架再秒切数据，体验接近 SPA/原生 APP。
 */

function BreadcrumbSkeleton() {
	return (
		<div className="flex gap-2 items-center mb-4" aria-hidden>
			<Skeleton className="w-8 h-4" />
			<Skeleton className="w-2 h-4" />
			<Skeleton className="w-16 h-4" />
			<Skeleton className="w-2 h-4" />
			<Skeleton className="w-24 h-4" />
		</div>
	);
}

export function GameDetailPageSkeleton() {
	return (
		<div aria-hidden>
			<BreadcrumbSkeleton />
			<div className="space-y-3">
				<GameCard.IdGameCardSkeleton />
				<div className="flex gap-2">
					<Skeleton className="w-24 h-8 rounded-full" />
					<Skeleton className="w-24 h-8 rounded-full" />
					<Skeleton className="w-24 h-8 rounded-full" />
				</div>
				<GameTabSkeleton />
			</div>
		</div>
	);
}

export function GameListPageSkeleton() {
	return (
		<div aria-hidden>
			<BreadcrumbSkeleton />
			<Skeleton className="mb-1 w-32 h-7" />
			<Skeleton className="mb-6 w-56 h-4" />
			<Skeleton className="mb-6 w-full max-w-lg h-10 rounded-lg" />
			<div className="flex gap-2 mb-6">
				<Skeleton className="w-20 h-8 rounded-md" />
				<Skeleton className="w-20 h-8 rounded-md" />
				<Skeleton className="w-20 h-8 rounded-md" />
				<Skeleton className="ml-auto w-20 h-8 rounded-md" />
			</div>
			<GameCardGridSkeleton />
		</div>
	);
}

export function ProducerListPageSkeleton() {
	return (
		<div className="space-y-4" aria-hidden>
			<BreadcrumbSkeleton />
			<Skeleton className="w-24 h-7" />
			<Skeleton className="w-full max-w-lg h-10 rounded-lg" />
			<div className="space-y-3">
				{[1, 2, 3, 4, 5].map((i) => (
					<Skeleton key={i} className="w-full h-16 rounded-lg" />
				))}
			</div>
		</div>
	);
}

export function ProducerDetailPageSkeleton() {
	const pid = useSelector(producerHeroStore, (s) => s.pid);
	return (
		<div aria-hidden>
			<BreadcrumbSkeleton />
			<Skeleton
				className="mb-2 w-48 h-7"
				style={
					pid
						? {
								viewTransitionName: `producer-name-${pid}`,
								viewTransitionClass: "producer-name vt-text",
							}
						: undefined
				}
			/>
			<Skeleton className="mb-6 w-72 h-4" />
			<GameCardGridSkeleton />
		</div>
	);
}

export function TopicsListPageSkeleton() {
	return (
		<div className="space-y-4" aria-hidden>
			<BreadcrumbSkeleton />
			<div className="flex justify-between items-center">
				<Skeleton className="w-20 h-7" />
				<Skeleton className="w-24 h-9 rounded-md" />
			</div>
			{[1, 2, 3, 4, 5].map((i) => (
				<Skeleton key={i} className="w-full h-24 rounded-lg" />
			))}
		</div>
	);
}

export function TopicDetailPageSkeleton() {
	return (
		<div className="space-y-4" aria-hidden>
			<BreadcrumbSkeleton />
			<div className="p-6 space-y-4 rounded-xl border">
				<Skeleton className="w-3/4 h-7" />
				<div className="flex gap-2 items-center">
					<Skeleton className="size-6 rounded-full" />
					<Skeleton className="w-20 h-4" />
					<Skeleton className="w-16 h-3" />
				</div>
				<div className="space-y-2">
					<Skeleton className="w-full h-4" />
					<Skeleton className="w-full h-4" />
					<Skeleton className="w-2/3 h-4" />
				</div>
			</div>
			<CommentThreadSkeleton />
		</div>
	);
}
