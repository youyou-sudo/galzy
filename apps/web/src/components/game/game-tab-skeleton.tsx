import { CommentThreadSkeleton } from "@web/components/cmments/comment-skeleton";
import { GameCard } from "@web/components/home/card";
import { SectionHeader } from "@web/components/shared/section-header";
import { Skeleton } from "@web/components/ui/skeleton";
import { BookOpen, TrendingUp } from "lucide-react";

/** 详情页五个页签：各自内容形状不同，加载态不能再共用一个通用骨架 */
export type GameTabKey =
	| "download"
	| "introduction"
	| "comment"
	| "translate"
	| "relations";

/**
 * 页签内容加载骨架：按页签返回对应形状。
 *
 * 复用原则：
 * - 下载 → FileListSkeleton（下载组件自身未就绪时也用同一个）
 * - 讨论 → CommentThreadSkeleton（论坛帖子详情同一份）
 * - 系列 → GameCard.ListSkeleton + 与真实关系栅格相同的断点/关系标签
 * - 攻略/统计 → 真实 SectionHeader + 对应行/图表占位，而不是通用三块灰条
 */
export function GameTabSkeleton({ tab = "download" }: { tab?: GameTabKey }) {
	switch (tab) {
		case "introduction":
			return <IntroductionTabSkeleton />;
		case "comment":
			return <CommentThreadSkeleton />;
		case "translate":
			return <TranslateTabSkeleton />;
		case "relations":
			return <RelationsTabSkeleton />;
		default:
			return <FileListSkeleton />;
	}
}

/** 攻略页签：真实区块标题 +「创建文章」按钮占位 + 文章行 */
function IntroductionTabSkeleton() {
	return (
		<div aria-hidden>
			<SectionHeader
				icon={BookOpen}
				title="攻略文章"
				action={<Skeleton className="w-24 h-8 rounded-lg" />}
			/>
			<ul className="flex flex-col divide-y divide-border/60">
				{(["w-3/5", "w-2/3", "w-1/2"] as const).map((width) => (
					<li key={width} className="flex gap-2 items-center py-2.5">
						<Skeleton className="shrink-0 size-4 rounded-sm" />
						<Skeleton className={`h-4 ${width}`} />
					</li>
				))}
			</ul>
		</div>
	);
}

/** 统计页签：真实区块标题 + 图表区域 */
function TranslateTabSkeleton() {
	return (
		<div aria-hidden>
			<SectionHeader icon={TrendingUp} title="总下载量" />
			<Skeleton className="w-full h-52 rounded-xl" />
		</div>
	);
}

/** 系列页签：与真实关系栅格相同断点，卡片沿用 GameCard.ListSkeleton */
function RelationsTabSkeleton() {
	return (
		<div
			aria-hidden
			className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
		>
			{Array.from({ length: 12 }, (_, i) => (
				<div key={i} className="relative">
					<GameCard.ListSkeleton />
					{/* 关系标签底片 */}
					<Skeleton className="absolute top-2 left-2 w-12 h-5 rounded-lg" />
				</div>
			))}
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
			<Skeleton className="w-full h-9 rounded-lg" />
			{FILE_ROW_WIDTHS.map((width) => (
				<Skeleton key={width} className={`h-7 rounded-md ${width}`} />
			))}
		</div>
	);
}
