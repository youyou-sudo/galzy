// @vitest-environment jsdom

import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** VT 活跃状态由用例驱动：mock 掉真实的 :active-view-transition 判定 */
const vtState = vi.hoisted(() => ({ active: false }));

vi.mock("@web/lib/view-transition", () => ({
	isViewTransitionActive: () => vtState.active,
}));

/** 调度器本身与 router 无关，避免在单测里拉起真实路由运行时 */
vi.mock("@web/lib/nav", () => ({
	useRouter: () => ({}),
}));

type ViewportPreloadModule = typeof import("./use-viewport-preload");

let mod: ViewportPreloadModule;
/** 手动驱动的 rAF 帧队列：stub requestAnimationFrame，逐帧确认轮询行为 */
let frames: FrameRequestCallback[];

/** 派发一帧（轮询链若仍在等 VT 会自行追加下一帧） */
function flushFrame() {
	const cb = frames.shift();
	cb?.(performance.now());
}

/** 让 schedule 内部 Promise.resolve().then(task) 的微任务跑完 */
async function flushMicrotasks() {
	await Promise.resolve();
	await Promise.resolve();
}

beforeEach(async () => {
	// 调度器状态是模块级单例（active / waiting / 排空句柄），逐用例重载隔离
	vi.resetModules();
	vtState.active = false;
	frames = [];
	vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
		frames.push(cb);
		return frames.length;
	});
	vi.stubGlobal("cancelAnimationFrame", () => {});
	mod = await import("./use-viewport-preload");
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("use-viewport-preload 的 VT 派发门控", () => {
	it("无 VT 时同步派发（行为与改动前一致）", async () => {
		const task = vi.fn(() => Promise.resolve());
		mod.__testSchedule(task);

		await flushMicrotasks();
		expect(task).toHaveBeenCalledTimes(1);
		// 没有 VT 就不该 arm 任何轮询帧
		expect(frames).toHaveLength(0);
	});

	it("VT 播放期间入队不执行，动画结束后补发一次", async () => {
		vtState.active = true;
		const task = vi.fn(() => Promise.resolve());
		mod.__testSchedule(task);

		await flushMicrotasks();
		expect(task).not.toHaveBeenCalled();
		// 已 arm 一帧等 VT 结束
		expect(frames).toHaveLength(1);

		// 动画仍在播放：当前帧只续挂下一帧，不派发
		flushFrame();
		expect(task).not.toHaveBeenCalled();
		expect(frames).toHaveLength(1);

		// 动画结束后的第一帧恢复派发，且只补发一次
		vtState.active = false;
		flushFrame();
		await flushMicrotasks();
		expect(task).toHaveBeenCalledTimes(1);
		expect(frames).toHaveLength(0);
	});

	it("排队期间取消：VT 结束后也不会执行", async () => {
		vtState.active = true;
		const task = vi.fn(() => Promise.resolve());
		const cancel = mod.__testSchedule(task);
		cancel();

		vtState.active = false;
		flushFrame();
		await flushMicrotasks();
		expect(task).not.toHaveBeenCalled();
	});

	it("VT 结束后仍按 MAX_CONCURRENT 派发，多余任务继续排队", async () => {
		vtState.active = true;
		const started: number[] = [];
		const total = mod.MAX_CONCURRENT + 2;
		for (let i = 0; i < total; i++) {
			mod.__testSchedule(() => {
				started.push(i);
				// 永不 resolve：占住并发名额，便于观察并发上限
				return new Promise<void>(() => {});
			});
		}
		await flushMicrotasks();
		expect(started).toEqual([]);

		vtState.active = false;
		flushFrame();
		await flushMicrotasks();
		expect(started).toEqual(
			Array.from({ length: mod.MAX_CONCURRENT }, (_, i) => i),
		);
	});

	it("默认意图模式：挂载不预取，hover 停留后才预取一条", async () => {
		vi.useFakeTimers();
		const el = document.createElement("a");
		document.body.appendChild(el);
		const makeTask = vi.fn(() => () => Promise.resolve());
		const ref = { current: el } as React.RefObject<HTMLAnchorElement>;
		renderHook(() => mod.useViewportPreload(ref, makeTask));

		await flushMicrotasks();
		expect(makeTask).not.toHaveBeenCalled();

		el.dispatchEvent(new Event("pointerenter"));
		vi.advanceTimersByTime(59);
		await flushMicrotasks();
		expect(makeTask).not.toHaveBeenCalled();

		vi.advanceTimersByTime(2);
		await flushMicrotasks();
		expect(makeTask).toHaveBeenCalledTimes(1);

		// 移开鼠标：取消尚未完成的那条预取
		el.dispatchEvent(new Event("pointerleave"));

		// 再次悬停不会重复绑定
		el.dispatchEvent(new Event("pointerenter"));
		vi.advanceTimersByTime(100);
		await flushMicrotasks();
		expect(makeTask).toHaveBeenCalledTimes(2);

		el.remove();
		vi.useRealTimers();
	});

	it("超过 1500ms 兜底时限后即使 VT 仍活跃也强制放行", async () => {
		const clock = { now: 1000 };
		vi.spyOn(performance, "now").mockImplementation(() => clock.now);

		vtState.active = true;
		const task = vi.fn(() => Promise.resolve());
		mod.__testSchedule(task);

		await flushMicrotasks();
		expect(task).not.toHaveBeenCalled();

		// 兜底时限内：继续等待
		flushFrame();
		expect(task).not.toHaveBeenCalled();

		// 超过兜底时限：即使 VT 判定仍为真也放行，避免队列死锁
		clock.now = 1000 + 1600;
		flushFrame();
		await flushMicrotasks();
		expect(task).toHaveBeenCalledTimes(1);
	});

	it("useIntentPreload 走同一调度：VT 期间悬停也延后到动画结束", async () => {
		vtState.active = true;
		const el = document.createElement("div");
		const ref = { current: el };
		const task = vi.fn(() => Promise.resolve());
		// 意图预取（hover/focus）与视口预取共享同一个 schedule 队列
		renderHook(() => mod.useIntentPreload(ref, () => task));

		// pointerenter 有 60ms 意图停留（避免划过列表连发请求）：等停留结束再断言
		el.dispatchEvent(new Event("pointerenter"));
		await new Promise((resolve) => setTimeout(resolve, 80));
		await flushMicrotasks();
		expect(task).not.toHaveBeenCalled();
		expect(frames).toHaveLength(1);

		vtState.active = false;
		flushFrame();
		await flushMicrotasks();
		expect(task).toHaveBeenCalledTimes(1);
	});
});
