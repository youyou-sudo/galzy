import { GameCard } from '@web/components/home/card'
import { GameTabSkeleton } from '@web/components/game/game-tab-skeleton'
import { Skeleton } from '@web/components/ui/skeleton'

/**
 * 路由 pendingComponent 骨架屏集合。
 * loader 等待超过 router.defaultPendingMs(100ms) 时渲染，快速点击时旧页面
 * 不再冻结等待，先出骨架再秒切数据，体验接近 SPA/原生 APP。
 */

function BreadcrumbSkeleton() {
	return (
		<div className="flex items-center gap-2 mb-4" aria-hidden>
			<Skeleton className="h-4 w-8" />
			<Skeleton className="h-4 w-2" />
			<Skeleton className="h-4 w-16" />
			<Skeleton className="h-4 w-2" />
			<Skeleton className="h-4 w-24" />
		</div>
	)
}

function GameCardGridSkeleton() {
	return (
		<div className="grid grid-cols-3 md:grid-cols-6 gap-4" aria-hidden>
			<GameCard.ListSkeleton />
			<GameCard.ListSkeleton />
			<GameCard.ListSkeleton />
			<GameCard.ListSkeleton />
			<GameCard.ListSkeleton />
			<GameCard.ListSkeleton />
		</div>
	)
}

export function GameDetailPageSkeleton() {
	return (
		<div aria-hidden>
			<BreadcrumbSkeleton />
			<div className="space-y-3">
				<GameCard.IdGameCardSkeleton />
				<div className="flex gap-2">
					<Skeleton className="h-8 w-24 rounded-full" />
					<Skeleton className="h-8 w-24 rounded-full" />
					<Skeleton className="h-8 w-24 rounded-full" />
				</div>
				<GameTabSkeleton />
			</div>
		</div>
	)
}

export function GameListPageSkeleton() {
	return (
		<div aria-hidden>
			<BreadcrumbSkeleton />
			<Skeleton className="h-7 w-32 mb-1" />
			<Skeleton className="h-4 w-56 mb-6" />
			<Skeleton className="h-10 w-full max-w-lg rounded-lg mb-6" />
			<div className="flex gap-2 mb-6">
				<Skeleton className="h-8 w-20 rounded-md" />
				<Skeleton className="h-8 w-20 rounded-md" />
				<Skeleton className="h-8 w-20 rounded-md" />
				<Skeleton className="h-8 w-20 rounded-md ml-auto" />
			</div>
			<GameCardGridSkeleton />
		</div>
	)
}

export function ProducerListPageSkeleton() {
	return (
		<div className="space-y-4" aria-hidden>
			<BreadcrumbSkeleton />
			<Skeleton className="h-7 w-24" />
			<Skeleton className="h-10 w-full max-w-lg rounded-lg" />
			<div className="space-y-3">
				{[1, 2, 3, 4, 5].map((i) => (
					<Skeleton key={i} className="h-16 w-full rounded-lg" />
				))}
			</div>
		</div>
	)
}

export function ProducerDetailPageSkeleton() {
	return (
		<div aria-hidden>
			<BreadcrumbSkeleton />
			<Skeleton className="h-7 w-48 mb-2" />
			<Skeleton className="h-4 w-72 mb-6" />
			<GameCardGridSkeleton />
		</div>
	)
}

export function TagDetailPageSkeleton() {
	return (
		<div aria-hidden>
			<BreadcrumbSkeleton />
			<Skeleton className="h-7 w-40 mb-2" />
			<Skeleton className="h-4 w-3/4 max-w-2xl mb-6" />
			<GameCardGridSkeleton />
		</div>
	)
}

export function TopicsListPageSkeleton() {
	return (
		<div className="space-y-4" aria-hidden>
			<BreadcrumbSkeleton />
			<div className="flex items-center justify-between">
				<Skeleton className="h-7 w-20" />
				<Skeleton className="h-9 w-24 rounded-md" />
			</div>
			{[1, 2, 3, 4, 5].map((i) => (
				<Skeleton key={i} className="h-24 w-full rounded-lg" />
			))}
		</div>
	)
}

export function TopicDetailPageSkeleton() {
	return (
		<div className="space-y-4" aria-hidden>
			<BreadcrumbSkeleton />
			<div className="rounded-xl border p-6 space-y-4">
				<Skeleton className="h-7 w-3/4" />
				<div className="flex items-center gap-2">
					<Skeleton className="size-6 rounded-full" />
					<Skeleton className="h-4 w-20" />
					<Skeleton className="h-3 w-16" />
				</div>
				<div className="space-y-2">
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-2/3" />
				</div>
			</div>
			<GameTabSkeleton />
		</div>
	)
}