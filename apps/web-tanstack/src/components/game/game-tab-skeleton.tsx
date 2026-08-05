/**
 * tab 内容区加载骨架（下载/攻略/讨论/统计通用）。
 * 仅在实际 loader 超过 pendingMs 仍未返回时展示，配合预加载切换 tab 时几乎不会出现。
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
