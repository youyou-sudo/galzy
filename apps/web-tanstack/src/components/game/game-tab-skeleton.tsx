import { Skeleton } from "@web/components/ui/skeleton";

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

// 文件条目行宽写死为 50% / 70% / 100%：长度不一才像真实的文件树，
// 但不能用随机值 —— 每次渲染随机会导致 pending 重渲染时宽度抖动。
const FILE_ROW_WIDTHS = ["w-[50%]", "w-[70%]", "w-full"] as const;

/**
 * 下载 tab 的文件列表骨架：形状对齐 download-options 的真实内容
 * （解压密码提示条 + 若干文件条目），让 pending 态与数据到达后的高度接近，
 * 避免 tab 内容区在 RPC 返回时整体跳动。
 * DownloadOptions 的未就绪分支复用同一个组件，两处视觉一致（不再各写一套骨架）。
 *
 * 统一走 ui/skeleton 的 Skeleton：触屏(coarse)下它会把常驻 pulse 降级成静态
 * 低透明度背景（见 skeleton.tsx），手写 animate-pulse div 会重新引入掉帧来源。
 */
export function FileListSkeleton() {
	return (
		<div className="space-y-2" aria-hidden>
			{/* 解压密码提示条 */}
			<Skeleton className="h-9 w-full rounded-lg" />
			{FILE_ROW_WIDTHS.map((width) => (
				<Skeleton key={width} className={`h-7 rounded-md ${width}`} />
			))}
		</div>
	);
}
