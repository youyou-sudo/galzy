import { useSyncExternalStore } from "react";
import { cn } from "@web/lib/utils";

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

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
	// 触屏下 animate-pulse 是常驻 opacity 动画（每帧样式重算 + 合成层），
	// 是滚动掉帧来源之一：改为静态低透明度背景；桌面保持 pulse 动画。
	const coarse = useCoarsePointer();
	return (
		<div
			data-slot="skeleton"
			className={cn(
				coarse
					? "rounded-md bg-muted/50"
					: "animate-pulse rounded-md bg-muted",
				className,
			)}
			{...props}
		/>
	);
}

export { Skeleton };
