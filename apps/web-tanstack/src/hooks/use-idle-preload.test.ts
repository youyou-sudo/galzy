// @vitest-environment jsdom

import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** VT 活跃状态由用例驱动 */
const vtState = vi.hoisted(() => ({ active: false }));
/** 稳定引用：useRouter 每次返回新对象会让 effect 反复重注册 */
const routerStub = vi.hoisted(() => ({}));

vi.mock("@web/lib/view-transition", () => ({
	isViewTransitionActive: () => vtState.active,
}));

vi.mock("@tanstack/react-router", () => ({
	useRouter: () => routerStub,
}));

type IdlePreloadModule = typeof import("./use-idle-preload");

let mod: IdlePreloadModule;
/** 手动驱动的 rAF 帧队列 */
let frames: FrameRequestCallback[];
/** 手动触发的 idle 回调（stub requestIdleCallback） */
let idleCallbacks: Array<() => void>;

function flushFrame() {
	const cb = frames.shift();
	cb?.(performance.now());
}

function fireIdle() {
	const run = idleCallbacks.shift();
	run?.();
}

beforeEach(async () => {
	vi.resetModules();
	vtState.active = false;
	frames = [];
	idleCallbacks = [];
	vi.stubGlobal(
		"requestIdleCallback",
		(cb: (deadline: IdleDeadline) => void) => {
			idleCallbacks.push(() =>
				cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline),
			);
			return idleCallbacks.length;
		},
	);
	vi.stubGlobal("cancelIdleCallback", () => {});
	vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
		frames.push(cb);
		return frames.length;
	});
	vi.stubGlobal("cancelAnimationFrame", () => {});
	mod = await import("./use-idle-preload");
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("use-idle-preload 的 VT 派发门控", () => {
	it("无 VT 时 idle 回调后立即执行（行为与改动前一致）", () => {
		const target = vi.fn();
		renderHook(() => mod.useIdlePreload([target]));
		expect(idleCallbacks).toHaveLength(1);

		fireIdle();
		expect(target).toHaveBeenCalledTimes(1);
		expect(frames).toHaveLength(0);
	});

	it("VT 播放期间不执行，动画结束后补发一次", () => {
		vtState.active = true;
		const target = vi.fn();
		renderHook(() => mod.useIdlePreload([target]));

		fireIdle();
		expect(target).not.toHaveBeenCalled();
		expect(frames).toHaveLength(1);

		// 动画仍在播放：续挂下一帧
		flushFrame();
		expect(target).not.toHaveBeenCalled();
		expect(frames).toHaveLength(1);

		vtState.active = false;
		flushFrame();
		expect(target).toHaveBeenCalledTimes(1);
		expect(frames).toHaveLength(0);
	});

	it("等待 VT 期间卸载：动画结束后也不再执行", () => {
		vtState.active = true;
		const target = vi.fn();
		const { unmount } = renderHook(() => mod.useIdlePreload([target]));

		fireIdle();
		expect(frames).toHaveLength(1);

		unmount();
		vtState.active = false;
		flushFrame();
		expect(target).not.toHaveBeenCalled();
	});

	it("VT 结束后 staggerMs 错峰语义保留", async () => {
		vtState.active = true;
		const first = vi.fn();
		const second = vi.fn();
		renderHook(() => mod.useIdlePreload([first, second], { staggerMs: 40 }));

		fireIdle();
		expect(first).not.toHaveBeenCalled();

		vtState.active = false;
		flushFrame();
		// 错峰走 setTimeout：同步返回时两个目标都还没执行
		expect(first).not.toHaveBeenCalled();
		expect(second).not.toHaveBeenCalled();

		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(first).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(1);
		// 0ms vs staggerMs：先后顺序保持
		expect(first.mock.invocationCallOrder[0]).toBeLessThan(
			second.mock.invocationCallOrder[0],
		);
	});
});
