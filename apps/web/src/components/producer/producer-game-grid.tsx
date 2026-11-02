import { GameCard } from "@web/components/home/card";
import { cn } from "@web/lib/utils";
import type { ComponentProps } from "react";

/** 首屏占位卡片数量：md 六列正好一整行 */
const PLACEHOLDER_CARDS = 6;

/**
 * 厂商详情页的游戏栅格 —— 固定 HTML，不参与加载态。
 *
 * 真实列表与 pending 占位共用同一份断点/间距，数据到达时列宽与行高都不跳；
 * 卡片外形（aspect 9/13 + 圆角）由 GameCard.ListSkeleton 与 GameCard.Item 各自
 * 从同一处比例常量推导，这里只负责外层栅格。
 */
export function ProducerGameGrid({
	className,
	...props
}: ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-6",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * 游戏数据还没到时的占位：只有卡片内部（封面 / 标题）出骨架，
 * 栅格本身是真实 HTML，列数/间距与真实列表完全一致。
 */
export function ProducerGameGridSkeleton() {
	return (
		<ProducerGameGrid aria-hidden>
			{Array.from({ length: PLACEHOLDER_CARDS }, (_, index) => (
				<GameCard.ListSkeleton key={index} />
			))}
		</ProducerGameGrid>
	);
}
