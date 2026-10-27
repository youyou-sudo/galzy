import { useEffect, useState } from "react";

/**
 * 视口宽度是否 ≥ minWidth（默认 1024）。
 *
 * 返回 null 表示「还没挂载」：弹层此时不渲染，避免两个问题——
 * - SSR 假设桌面端 / 客户端其实是手机时，Sheet 与 Drawer 挂到 body 上造成的
 *   hydration 不一致；
 * - 用 `useIsMobile`（768）决定「用哪个容器」会在 768–1023 之间形成空洞
 *   （既没有桌面侧栏也没有底部抽屉，点了行毫无反馈）。
 *
 * 详情抽屉在页面挂载时就调用本 hook，用户点开时 matchMedia 结果已就绪，
 * 因此不会出现打开瞬间的一帧空白。
 */
export function useIsWideViewport(minWidth = 1024): boolean | null {
	const [isWide, setIsWide] = useState<boolean | null>(null);

	useEffect(() => {
		if (
			typeof window === "undefined" ||
			typeof window.matchMedia !== "function"
		) {
			setIsWide(true);
			return;
		}

		const media = window.matchMedia(`(min-width: ${minWidth}px)`);
		const update = () => setIsWide(media.matches);
		update();
		media.addEventListener("change", update);
		return () => media.removeEventListener("change", update);
	}, [minWidth]);

	return isWide;
}
