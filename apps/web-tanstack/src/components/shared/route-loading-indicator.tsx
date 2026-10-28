import { useRouterState } from "@tanstack/react-router";
import { Spinner } from "@web/components/ui/spinner";
import { cn } from "@web/lib/utils";
import { useEffect, useRef, useState } from "react";

/** 最短可见时长：导航可能在 1~2 帧内结束，没有下限时图标只会闪一下，看不出发生了什么。 */
export const MIN_VISIBLE_MS = 200;
/** 与淡出 transition 的 duration-150 对齐（略留余量）；播完才回到 idle。 */
export const EXIT_MS = 150;

type Phase = "idle" | "active" | "leaving";

/**
 * 页面切换加载指示器：右上角一个 spinner，不遮内容、不显示进度条。
 *
 * 交互与 nprogress 一类「切换即亮」一致：
 * - 路由进入 pending 立即淡入（预加载命中的 1~2 帧跳转也至少亮 MIN_VISIBLE_MS，
 *   否则图标只会闪一帧）；
 * - pending 结束后先停到最短可见时长，再淡出；淡出播完 EXIT_MS 回 idle。
 *
 * 动效「从上往下」：淡入时从上方 16px 落到原位，淡出时继续向下 8px 消失。
 * 只过渡 opacity 与 translate 两个合成器属性，不触发 layout/paint。
 *
 * 位置：
 * - 顶栏铺满整个宽度时（窄屏；后台 AdminShell 顶栏始终铺满），贴顶栏下沿；
 * - 宽屏用户端顶栏内容限宽 max-w-7xl 居中、右上角本来空着，此时直接贴视口角落。
 * 两种模式的高度都从 --app-header-height 令牌派生，不写魔法数。
 */
export function RouteLoadingIndicator() {
	const isPending = useRouterState({ select: (s) => s.status === "pending" });
	// 后台顶栏（AdminShell）铺满整宽，右上角被主题/头像占住 → 始终退回顶栏下沿
	const isAdmin = useRouterState({
		select: (s) => s.matches.some((m) => m.routeId.startsWith("/admin/")),
	});
	const [phase, setPhase] = useState<Phase>("idle");
	/** 本次亮起的时刻；用 Date.now 记录，测试里 vi.useFakeTimers 会一并接管。 */
	const shownAtRef = useRef(0);

	useEffect(() => {
		if (isPending) {
			if (phase === "active") return;
			// 立即亮起；上一轮淡出还没播完时也走这里转回常显（重置计时）
			shownAtRef.current = Date.now();
			setPhase("active");
			return;
		}

		if (phase === "active") {
			const remaining = MIN_VISIBLE_MS - (Date.now() - shownAtRef.current);
			const timer = setTimeout(
				() => setPhase("leaving"),
				Math.max(0, remaining),
			);
			return () => clearTimeout(timer);
		}

		if (phase === "leaving") {
			const timer = setTimeout(() => setPhase("idle"), EXIT_MS);
			return () => clearTimeout(timer);
		}
	}, [isPending, phase]);

	return (
		<div
			// 调试/测试可读的当前相位；不影响样式
			data-route-loading={phase}
			// 图标本身是纯视觉（Spinner 已 aria-hidden），语义交给容器的 live region：
			// 进入 active 时插入 sr-only 文案，慢导航下屏幕阅读器播报一次
			role="status"
			aria-live="polite"
			className={cn(
				// 全程不接收指针事件；
				// z-40：高于正文，低于顶栏(50)与弹窗/抽屉遮罩(50)，弹窗打开时不会浮在上面
				"pointer-events-none fixed right-3 z-40 select-none sm:right-4",
				// 顶栏占满宽度时贴顶栏下沿；宽屏用户端顶栏是 max-w-7xl 居中、右上角为空，
				// 才贴真正的视口角落。85rem ≈ 80rem(7xl) + 两侧各 1rem 图标与边距/间隙。
				"top-[calc(var(--app-header-height)_+_0.5rem)]",
				!isAdmin && "min-[85rem]:top-3",
				// 只用 opacity + translate，减少主线程样式重算
				"transition-[opacity,translate] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
				"motion-reduce:transition-none",
				phase === "idle" && "-translate-y-4 opacity-0",
				phase === "active" && "translate-y-0 opacity-100",
				phase === "leaving" && "translate-y-2 opacity-0",
			)}
		>
			<Spinner
				aria-hidden="true"
				className="text-primary drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
			/>
			{phase === "active" ? <span className="sr-only">页面加载中</span> : null}
		</div>
	);
}
