import { cn } from "@web/lib/utils";
import { useSyncExternalStore } from "react";

// 触屏(coarse)指针：模块级一次性 matchMedia；SSR/测试环境恒 null → false。
const coarseMediaQuery =
	typeof window !== "undefined" && typeof window.matchMedia === "function"
		? window.matchMedia("(pointer: coarse)")
		: null;

function subscribeCoarsePointer(onChange: () => void): () => void {
	coarseMediaQuery?.addEventListener("change", onChange);
	return () => coarseMediaQuery?.removeEventListener("change", onChange);
}

function useCoarsePointer(): boolean {
	return useSyncExternalStore(
		subscribeCoarsePointer,
		() => coarseMediaQuery?.matches ?? false,
		() => false,
	);
}

function Skeleton({
	className,
	as: As = "div",
	...props
}: React.ComponentProps<"div"> & {
	/**
	 * 默认 div。放进 h1/p 这类只允许 phrasing content 的容器时必须用 span：
	 * 否则浏览器/React 会报「<div> cannot be a descendant of <p>」（hydration 隐患）。
	 * 盒模型（block / inline-block）仍由 className 控制，视觉不变。
	 */
	as?: "div" | "span";
}) {
	// 触屏下 animate-pulse 是常驻 opacity 动画（每帧样式重算 + 合成层），
	// 是滚动掉帧来源之一：改为静态低透明度背景；桌面保持 pulse 动画。
	const coarse = useCoarsePointer();
	return (
		<As
			data-slot="skeleton"
			className={cn(
				coarse ? "bg-muted/50 rounded-md" : "bg-muted rounded-md animate-pulse",
				className,
			)}
			{...props}
		/>
	);
}

export { Skeleton };
