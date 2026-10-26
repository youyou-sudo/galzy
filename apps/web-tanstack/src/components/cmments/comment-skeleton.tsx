import { Skeleton } from "@web/components/ui/skeleton";

/**
 * 讨论区骨架：输入框 + 3 条紧凑评论（头像、昵称、正文、时间）。
 * 游戏讨论页签与论坛帖子详情共用，避免两处各写一套形状。
 */
export function CommentThreadSkeleton() {
	return (
		<div className="space-y-3" aria-hidden>
			<Skeleton className="h-20 w-full rounded-xl" />
			<div className="space-y-2">
				{[0, 1, 2].map((i) => (
					<div
						key={i}
						className="flex gap-2.5 border-b border-border/60 pb-2 last:border-0"
					>
						<Skeleton className="size-7 shrink-0 rounded-full" />
						<div className="flex-1 space-y-1.5">
							<Skeleton className="h-3 w-24" />
							<Skeleton className="h-3.5 w-full" />
							<Skeleton className="h-3.5 w-2/3" />
							<Skeleton className="h-3 w-16" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
