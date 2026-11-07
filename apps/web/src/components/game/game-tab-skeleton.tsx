import { CommentThreadSkeleton } from "@web/components/cmments/comment-skeleton";
import { GameCard } from "@web/components/home/card";
import { SectionHeader } from "@web/components/shared/section-header";
import { Skeleton } from "@web/components/ui/skeleton";
import { TrendingUp } from "lucide-react";

/** 详情页六个页签：各自内容形状不同，加载态不能再共用一个通用骨架 */
export type GameTabKey =
	| "download"
	| "characters"
	| "walkthrough"
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
		case "characters":
			return <CharactersTabSkeleton />;
		case "walkthrough":
			return <WalkthroughTabSkeleton />;
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

/**
 * 攻略页签：概览块 → 视图工具栏 → 角色路线卡 → 内容区，四段与真实攻略页同序。
 * 高度写死成整段（而不是几十个小块）：攻略正文长度不可预知，
 * 骨架只负责「有内容在加载」的观感，不在数据到达时制造高度跳变。
 */
function WalkthroughTabSkeleton() {
	return (
		<div aria-hidden className="space-y-6">
			<Skeleton className="w-full h-24 rounded-xl" />
			{/* 视图 / 语言选项卡：真实页里角色选择在它下面 */}
			<Skeleton className="w-full h-9 rounded-xl" />
			<div>
				{/* 真实页已经没有「角色路线」标题，只剩一行提示小字 */}
				<p className="mb-3 text-muted-foreground text-xs">
					选择角色查看这条路线的选项
				</p>
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
					{(["w-1/2", "w-3/5", "w-2/5"] as const).map((width) => (
						<div
							key={width}
							className="flex flex-col gap-2 p-3 rounded-xl ring-1 ring-border/60"
						>
							<Skeleton className={`h-4 ${width}`} />
							<Skeleton className="w-2/3 h-3" />
						</div>
					))}
				</div>
			</div>
			<Skeleton className="w-full h-64 rounded-xl" />
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

/**
 * 详情（角色）页签：与真实角色栅格相同断点 + 竖版卡片 + 两行姓名。
 * 真实列表是扁平栅格（身份靠卡片左上角徽章表达），骨架同样不放分组标题，
 * 只在封面上放一枚徽章底片。
 */
function CharactersTabSkeleton() {
	return (
		<div
			aria-hidden
			className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 sm:gap-x-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7"
		>
			{Array.from({ length: 12 }, (_, i) => (
				<div key={i} className="flex flex-col gap-2">
					<div className="relative">
						<Skeleton className="w-full rounded-xl aspect-[3/4]" />
						<Skeleton className="absolute top-1.5 left-1.5 w-8 h-4 rounded-md" />
					</div>
					<Skeleton className="w-2/3 h-4" />
					<Skeleton className="w-1/2 h-3" />
				</div>
			))}
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
