/**
 * tab 内容区加载骨架（下载/攻略/讨论/统计通用）。
 * loader 未返回即展示（defaultPendingMs=0），配合预加载切换时几乎不会出现。
 */
export function GameTabSkeleton() {
	return (
		<div className="space-y-3 p-2" aria-hidden>
			<div className="h-10 w-full max-w-md rounded-lg bg-muted animate-pulse" />
			<div className="h-24 w-full rounded-xl bg-muted animate-pulse" />
			<div className="h-24 w-full rounded-xl bg-muted animate-pulse" />
			<div className="h-24 w-full rounded-xl bg-muted animate-pulse" />
		</div>
	);
}
