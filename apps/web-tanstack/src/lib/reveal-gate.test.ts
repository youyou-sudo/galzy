// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type RevealGateModule = typeof import("./reveal-gate");

/**
 * reveal-gate 是模块级单例（scrolling / pending 状态跨用例残留），
 * 每个用例前 resetModules + 动态 import 拿到全新实例隔离。
 * 注意 resetModules 会重新执行模块初始化，往 window 上重复注册
 * scroll 监听 —— 同一事件触发多次 handler 无副作用（幂等置位）。
 */
let mod: RevealGateModule;

beforeEach(async () => {
	vi.resetModules();
	vi.useFakeTimers();
	mod = await import("./reveal-gate");
});

afterEach(() => {
	vi.useRealTimers();
});

describe("reveal-gate", () => {
	it("未门控时 gateCommit 同步立即执行", () => {
		const commit = vi.fn();
		const cancel = mod.gateCommit(commit);

		expect(commit).toHaveBeenCalledTimes(1);
		cancel();
		expect(commit).toHaveBeenCalledTimes(1);
	});

	it("滚动中挂起提交，滚动静默 180ms 后 flush", () => {
		window.dispatchEvent(new Event("scroll"));
		const commit = vi.fn();
		mod.gateCommit(commit);

		expect(mod.isRevealGated()).toBe(true);
		// 静默窗口（180ms）内不执行
		vi.advanceTimersByTime(100);
		expect(commit).not.toHaveBeenCalled();

		// settle（180ms）+ 重试链（80ms）余量，推进足够时间
		vi.advanceTimersByTime(200);
		expect(commit).toHaveBeenCalledTimes(1);
		expect(mod.isRevealGated()).toBe(false);
	});

	it("取消函数生效：挂起后取消，flush 不再执行", () => {
		window.dispatchEvent(new Event("scroll"));
		const commit = vi.fn();
		const cancel = mod.gateCommit(commit);
		cancel();

		vi.advanceTimersByTime(300);
		expect(commit).not.toHaveBeenCalled();
	});

	it("多个挂起 commit 批量 flush 全部执行", () => {
		window.dispatchEvent(new Event("scroll"));
		const first = vi.fn();
		const second = vi.fn();
		mod.gateCommit(first);
		mod.gateCommit(second);

		vi.advanceTimersByTime(300);
		expect(first).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(1);
	});

	it("持续滚动时兜底强刷：超过 MAX_WAIT_MS=1500 后强制执行", () => {
		window.dispatchEvent(new Event("scroll"));
		const commit = vi.fn();
		mod.gateCommit(commit);

		// 持续派发 scroll 保持 scrolling=true，越过所有 settle 窗口
		const keepScrolling = setInterval(() => {
			window.dispatchEvent(new Event("scroll"));
		}, 100);
		vi.advanceTimersByTime(1600);
		clearInterval(keepScrolling);

		expect(commit).toHaveBeenCalledTimes(1);
	});

	it("settle 窗口内新 scroll 事件重置静默计时", () => {
		window.dispatchEvent(new Event("scroll"));
		const commit = vi.fn();
		mod.gateCommit(commit);

		vi.advanceTimersByTime(100);
		// 距上次 scroll 仅 100ms 时再来一次，静默窗口重算
		window.dispatchEvent(new Event("scroll"));
		vi.advanceTimersByTime(100);
		// 距第二次 scroll 才 100ms（<180ms），不应 flush
		expect(commit).not.toHaveBeenCalled();

		vi.advanceTimersByTime(100);
		expect(commit).toHaveBeenCalledTimes(1);
	});
});
