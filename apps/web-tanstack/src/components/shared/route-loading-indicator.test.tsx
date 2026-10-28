// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	EXIT_MS,
	MIN_VISIBLE_MS,
	RouteLoadingIndicator,
} from "./route-loading-indicator";

// 路由状态用可变对象驱动：mock 的 useRouterState 每次渲染读取当前值，
// 测试里改 routerMock.status 后 rerender 即可模拟一次导航。
const routerMock = vi.hoisted(() => ({
	status: "idle" as "idle" | "pending",
	matches: [] as { routeId: string }[],
}));

vi.mock("@tanstack/react-router", () => ({
	useRouterState: (options?: {
		select?: (state: {
			status: "idle" | "pending";
			matches: { routeId: string }[];
		}) => unknown;
	}) => (options?.select ? options.select(routerMock) : routerMock),
}));

function indicator() {
	return document.querySelector("[data-route-loading]");
}

function phase() {
	return indicator()?.getAttribute("data-route-loading");
}

/** 推进假时钟并同步刷 React 状态 */
function tick(ms: number) {
	act(() => {
		vi.advanceTimersByTime(ms);
	});
}

function navigate(
	rerender: (ui: React.ReactElement) => void,
	status: "idle" | "pending",
) {
	routerMock.status = status;
	rerender(<RouteLoadingIndicator />);
}

beforeEach(() => {
	vi.useFakeTimers();
	routerMock.status = "idle";
	routerMock.matches = [];
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe("RouteLoadingIndicator", () => {
	it("初始不可见、不播报，且位置/层级/动效类名正确", () => {
		render(<RouteLoadingIndicator />);

		expect(phase()).toBe("idle");
		expect(indicator()?.textContent).toBe("");
		expect(indicator()?.getAttribute("role")).toBe("status");
		expect(indicator()?.getAttribute("aria-live")).toBe("polite");

		const className = indicator()?.className ?? "";
		expect(className).toContain("pointer-events-none");
		expect(className).toContain("opacity-0");
		// 从上方落下：空闲态先向上偏移一档，进入时过渡到 0
		expect(className).toContain("-translate-y-4");
		// 高于正文但低于顶栏/弹窗遮罩
		expect(className).toContain("z-40");
		// 减少动效偏好下只保留透明度变化
		expect(className).toContain("motion-reduce:transition-none");
	});

	it("宽屏用户端贴视口右上角，后台（顶栏铺满宽度）退回顶栏下沿", () => {
		const { rerender } = render(<RouteLoadingIndicator />);

		const className = () => indicator()?.className ?? "";
		// 默认落在顶栏下沿，宽屏（顶栏内容限宽、右上角为空）才提升到视口角落
		expect(className()).toContain(
			"top-[calc(var(--app-header-height)_+_0.5rem)]",
		);
		expect(className()).toContain("min-[85rem]:top-3");

		// 后台顶栏铺满整宽，右上角被主题/头像占住 → 不提升
		routerMock.matches = [{ routeId: "/admin/_authL" }];
		rerender(<RouteLoadingIndicator />);
		expect(className()).not.toContain("min-[85rem]:top-3");
		expect(className()).toContain(
			"top-[calc(var(--app-header-height)_+_0.5rem)]",
		);
	});

	it("导航进入 pending 立即淡入并向读屏播报一次", () => {
		const { rerender } = render(<RouteLoadingIndicator />);

		navigate(rerender, "pending");
		expect(phase()).toBe("active");
		expect(indicator()?.className).toContain("opacity-100");
		expect(indicator()?.className).toContain("translate-y-0");
		expect(indicator()?.textContent).toBe("页面加载中");
	});

	it("秒开跳转也至少亮满最短可见时长，再向下淡出", () => {
		const { rerender } = render(<RouteLoadingIndicator />);

		navigate(rerender, "pending");
		tick(1);
		// 40ms 后加载结束：剩余最短可见时长 160ms
		tick(39);
		navigate(rerender, "idle");

		tick(MIN_VISIBLE_MS - 40 - 10);
		expect(phase()).toBe("active");

		tick(10);
		expect(phase()).toBe("leaving");
		expect(indicator()?.className).toContain("translate-y-2");
		// 淡出不再有 live region 文案，避免重复播报
		expect(indicator()?.textContent).toBe("");

		tick(EXIT_MS);
		expect(phase()).toBe("idle");
	});

	it("长时间 pending 期间持续显示，不会到点自行消失", () => {
		const { rerender } = render(<RouteLoadingIndicator />);

		navigate(rerender, "pending");
		tick(MIN_VISIBLE_MS * 3);
		expect(phase()).toBe("active");

		navigate(rerender, "idle");
		tick(0);
		expect(phase()).toBe("leaving");
		tick(EXIT_MS);
		expect(phase()).toBe("idle");
	});

	it("淡出途中再次导航直接转回常显，不先隐后现", () => {
		const { rerender } = render(<RouteLoadingIndicator />);

		navigate(rerender, "pending");
		tick(1);
		navigate(rerender, "idle");
		tick(MIN_VISIBLE_MS);
		expect(phase()).toBe("leaving");

		navigate(rerender, "pending");
		expect(phase()).toBe("active");
		expect(indicator()?.textContent).toBe("页面加载中");
	});

	it("卸载时清理未触发的定时器", () => {
		const { rerender, unmount } = render(<RouteLoadingIndicator />);

		navigate(rerender, "pending");
		navigate(rerender, "idle");
		expect(vi.getTimerCount()).toBeGreaterThan(0);

		unmount();
		expect(vi.getTimerCount()).toBe(0);
	});
});
