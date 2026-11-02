// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	COMPLETE_MS,
	CREEP_CEILING,
	CREEP_MS,
	FADE_MS,
	HOLD_AT_FULL_MS,
	MAX_PENDING_MS,
	REDUCED_MOTION_PROGRESS,
	SHOW_DELAY_MS,
	TopProgressBar,
} from "./top-progress-bar";

// 导航 pending 由用例驱动：mock 掉 nav 的订阅 hook，避免拉起真实路由运行时。
const navMock = vi.hoisted(() => ({ pending: false }));

vi.mock("@web/lib/nav", () => ({
	useNavigationPending: () => navMock.pending,
}));

function bar() {
	return document.querySelector<HTMLElement>("[data-top-progress]");
}

function opacity() {
	return bar()?.style.opacity;
}

function scaleX() {
	const match = /scaleX\(([\d.]+)\)/.exec(bar()?.style.transform ?? "");
	return match ? Number(match[1]) : Number.NaN;
}

function transition() {
	return bar()?.style.transition ?? "";
}

/** 推进假时钟并同步刷 React 状态 */
function tick(ms: number) {
	act(() => {
		vi.advanceTimersByTime(ms);
	});
}

function setPending(
	rerender: (ui: React.ReactElement) => void,
	pending: boolean,
) {
	navMock.pending = pending;
	rerender(<TopProgressBar />);
}

beforeEach(() => {
	vi.useFakeTimers();
	navMock.pending = false;
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("TopProgressBar", () => {
	it("300ms 内切完：全程不显示", () => {
		const { rerender } = render(<TopProgressBar />);
		setPending(rerender, true);
		tick(SHOW_DELAY_MS - 10);
		expect(opacity()).toBe("0");
		setPending(rerender, false);
		tick(SHOW_DELAY_MS * 2);
		expect(opacity()).toBe("0");
		expect(scaleX()).toBe(0);
	});

	it("超过 300ms 仍未切完才亮起", () => {
		const { rerender } = render(<TopProgressBar />);
		setPending(rerender, true);
		tick(SHOW_DELAY_MS - 1);
		expect(opacity()).toBe("0");
		tick(1);
		expect(opacity()).toBe("1");
		expect(scaleX()).toBe(CREEP_CEILING);
	});

	it("爬升是一条连续的长过渡，不是分段短过渡（丝滑的关键）", () => {
		const { rerender } = render(<TopProgressBar />);
		setPending(rerender, true);
		tick(SHOW_DELAY_MS);
		const value = transition();
		// transform 只有一条 CREEP_MS 的长过渡；短过渡只允许出现在 opacity 上
		expect(value).toContain(`transform ${CREEP_MS}ms`);
		expect(value).toContain(`opacity ${FADE_MS}ms`);
	});

	it("爬升期间不创建任何逐帧/逐段定时器", () => {
		const { rerender } = render(<TopProgressBar />);
		setPending(rerender, true);
		tick(SHOW_DELAY_MS);
		const timerCount = vi.getTimerCount();
		tick(2_000);
		// 只剩 MAX_PENDING_MS 兜底定时器，没有 interval / 逐帧调度
		expect(vi.getTimerCount()).toBe(timerCount);
	});

	it("切换完成：换成短过渡补满 100% → 停留 → 淡出 → 归零", () => {
		const { rerender } = render(<TopProgressBar />);
		setPending(rerender, true);
		tick(SHOW_DELAY_MS);
		setPending(rerender, false);
		expect(scaleX()).toBe(1);
		expect(opacity()).toBe("1");
		expect(transition()).toContain(`${COMPLETE_MS}ms`);
		tick(COMPLETE_MS + HOLD_AT_FULL_MS);
		expect(opacity()).toBe("0");
		tick(FADE_MS);
		expect(scaleX()).toBe(0);
		expect(transition()).toBe("none");
	});

	it("淡出/停留期间开始新导航：不残留 100%，重新从 0 爬到 92%", () => {
		const { rerender } = render(<TopProgressBar />);
		setPending(rerender, true);
		tick(SHOW_DELAY_MS);
		setPending(rerender, false);
		tick(40); // 停留在「已补满」阶段
		setPending(rerender, true);
		tick(SHOW_DELAY_MS);
		expect(opacity()).toBe("1");
		expect(scaleX()).toBe(CREEP_CEILING);
	});

	it("prefers-reduced-motion：不做爬升，停在固定位置", () => {
		vi.stubGlobal("matchMedia", (query: string) => ({
			matches: query.includes("prefers-reduced-motion"),
			media: query,
			addEventListener: () => {},
			removeEventListener: () => {},
			addListener: () => {},
			removeListener: () => {},
			onchange: null,
			dispatchEvent: () => false,
		}));
		const { rerender } = render(<TopProgressBar />);
		setPending(rerender, true);
		tick(SHOW_DELAY_MS);
		expect(scaleX()).toBe(REDUCED_MOTION_PROGRESS);
		// 只有 opacity 过渡，没有 transform 爬升
		expect(transition()).not.toContain("transform");
	});

	it("pending 卡死时按 MAX_PENDING_MS 兜底收尾", () => {
		const { rerender } = render(<TopProgressBar />);
		setPending(rerender, true);
		tick(SHOW_DELAY_MS);
		expect(opacity()).toBe("1");
		tick(MAX_PENDING_MS); // 兜底触发：开始补满
		expect(scaleX()).toBe(1);
		tick(COMPLETE_MS + HOLD_AT_FULL_MS);
		expect(opacity()).toBe("0");
	});

	it("卸载时清掉全部定时器", () => {
		const { rerender, unmount } = render(<TopProgressBar />);
		setPending(rerender, true);
		tick(SHOW_DELAY_MS);
		unmount();
		expect(vi.getTimerCount()).toBe(0);
	});
});
