import * as React from "react";

/** 站点默认的手机断点（与 Tailwind 的 md = 768 对齐） */
const MOBILE_BREAKPOINT = 768;

/**
 * 视口是否窄于 breakpoint（默认 768，即 Tailwind 的 md 以下）。
 *
 * 只在客户端求值：SSR 与没有 matchMedia 的测试环境都按桌面处理。
 * 用 innerWidth 作为唯一口径 —— 真机上与 matchMedia 等价，但 jsdom 里
 * 可以直接改 innerWidth 测窄屏分支；matchMedia 缺失时也不会抛错。
 */
export function useIsNarrow(breakpoint = MOBILE_BREAKPOINT) {
	const [isNarrow, setIsNarrow] = React.useState(false);

	React.useEffect(() => {
		const update = () => setIsNarrow(window.innerWidth < breakpoint);
		update();
		window.addEventListener("resize", update);
		const media =
			typeof window.matchMedia === "function"
				? window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
				: null;
		media?.addEventListener("change", update);
		return () => {
			window.removeEventListener("resize", update);
			media?.removeEventListener("change", update);
		};
	}, [breakpoint]);

	return isNarrow;
}

/** 是否手机断点（<768，与 Tailwind 的 md 对齐） */
export function useIsMobile() {
	return useIsNarrow(MOBILE_BREAKPOINT);
}
