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
/** 模拟 html 是否命中 :active-view-transition（jsdom 的 nwsapi 不支持该伪类） */
let vtActive = false;

beforeEach(async () => {
	vi.resetModules();
	vi.useFakeTimers();
	vtActive = false;
	// jsdom 直接 matches(':active-view-transition') 会抛错（nwsapi 不支持），
	// 用 spy 接管 html 元素的 matches，模拟真机上的伪类状态；其余选择器
	// 保持「不匹配」，避免影响测试里的普通查询。
	vi.spyOn(document.documentElement, "matches").mockImplementation(
		(selector: string) => selector === ":active-view-transition" && vtActive,
	);
	mod = await import("./reveal-gate");
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
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

	it("分片 flush：超过 FLUSH_CHUNK_SIZE=6 时逐帧排空，每个 commit 只执行一次", () => {
		window.dispatchEvent(new Event("scroll"));
		const commits = Array.from({ length: 8 }, () => vi.fn());
		for (const c of commits) mod.gateCommit(c);

		// settle 180ms 到点 flush：第一片最多 6 个同步执行
		// （精确推进到 flush 时刻，避免 rAF 分片帧在同一次推进中继续排空）
		vi.advanceTimersByTime(180);
		const head = commits.slice(0, 6);
		for (const c of head) expect(c).toHaveBeenCalledTimes(1);
		expect(commits[6]).not.toHaveBeenCalled();
		expect(commits[7]).not.toHaveBeenCalled();

		// 分片帧排空剩余两个（fake rAF 按全局 16ms tick 触发，单次推进
		// 可能带过多帧，因此只断言最终逐帧排空完成且不重复执行）
		vi.advanceTimersByTime(16);
		expect(commits[6]).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(100);
		expect(commits[7]).toHaveBeenCalledTimes(1);
		// 已执行的 commit 不会重复执行
		for (const c of commits) expect(c).toHaveBeenCalledTimes(1);
	});

	it("兜底定时器到点后同样分片执行：第一片立即执行，剩余逐帧排空", () => {
		window.dispatchEvent(new Event("scroll"));
		const commits = Array.from({ length: 8 }, () => vi.fn());
		for (const c of commits) mod.gateCommit(c);

		// 持续滚动保持门控，越过所有 settle 窗口
		const keepScrolling = setInterval(() => {
			window.dispatchEvent(new Event("scroll"));
		}, 100);
		// 精确推进到 maxWait 到点时刻，第一片同步执行、分片帧尚未排空
		vi.advanceTimersByTime(1500);
		clearInterval(keepScrolling);

		// maxWait 到点：第一片（6 个）立即执行，剩余不执行
		const head = commits.slice(0, 6);
		for (const c of head) expect(c).toHaveBeenCalledTimes(1);
		expect(commits[6]).not.toHaveBeenCalled();
		expect(commits[7]).not.toHaveBeenCalled();

		// 逐帧排空剩余两个
		vi.advanceTimersByTime(16);
		expect(commits[6]).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(16);
		expect(commits[7]).toHaveBeenCalledTimes(1);
	});

	it("分片排空中所有 pending 被取消 → 停止排程，不再执行", () => {
		window.dispatchEvent(new Event("scroll"));
		const commits: Array<ReturnType<typeof vi.fn>> = [];
		const cancels: Array<() => void> = [];
		for (let i = 0; i < 8; i++) {
			const c = vi.fn();
			commits.push(c);
			cancels.push(mod.gateCommit(c));
		}

		// 第一片 6 个已执行（精确推进到 flush 时刻）
		vi.advanceTimersByTime(180);
		for (const c of commits.slice(0, 6)) expect(c).toHaveBeenCalledTimes(1);

		// 取消尚未执行的第 7、8 个：pending 清空后取消排程中的分片帧
		cancels[6]();
		cancels[7]();

		vi.advanceTimersByTime(100);
		expect(commits[6]).not.toHaveBeenCalled();
		expect(commits[7]).not.toHaveBeenCalled();
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

describe("commitAfterViewTransition", () => {
	it("无 VT 时同步提交，取消函数为空操作", () => {
		const commit = vi.fn();
		const cancel = mod.commitAfterViewTransition(commit);

		expect(commit).toHaveBeenCalledTimes(1);
		cancel();
		expect(commit).toHaveBeenCalledTimes(1);
	});

	it("VT 活跃时不执行；VT 结束后在微任务里立即放行（不多等一帧）", async () => {
		vtActive = true;
		const commit = vi.fn();
		mod.commitAfterViewTransition(commit);

		// 动画进行中，轮询若干帧都不提交
		vi.advanceTimersByTime(16);
		vi.advanceTimersByTime(16);
		expect(commit).not.toHaveBeenCalled();

		// 伪类解除：下一轮询帧发现结束，微任务立即执行，不需要再等一帧
		vtActive = false;
		vi.advanceTimersByTime(16);
		expect(commit).not.toHaveBeenCalled();
		await Promise.resolve();
		expect(commit).toHaveBeenCalledTimes(1);
	});

	it("VT 结束后被新 VT 接管：继续等待，不提前提交", async () => {
		vtActive = true;
		const commit = vi.fn();
		mod.commitAfterViewTransition(commit);

		// 第一个轮询帧仍命中（结束瞬间又被新 VT 接管）→ 继续等，不提交
		vi.advanceTimersByTime(16);
		await Promise.resolve();
		expect(commit).not.toHaveBeenCalled();

		// 新 VT 也结束才放行
		vtActive = false;
		vi.advanceTimersByTime(16);
		await Promise.resolve();
		expect(commit).toHaveBeenCalledTimes(1);
	});

	it("一次入队 8 个：第一片 6 个立即执行，剩余逐帧排空", async () => {
		vtActive = true;
		const commits = Array.from({ length: 8 }, () => vi.fn());
		for (const c of commits) mod.commitAfterViewTransition(c);
		expect(commits[0]).not.toHaveBeenCalled();

		vtActive = false;
		vi.advanceTimersByTime(16);
		// 微任务：第一片（≤ FLUSH_CHUNK_SIZE=6）同步执行，剩余留到下一帧
		await Promise.resolve();
		for (const c of commits.slice(0, 6)) expect(c).toHaveBeenCalledTimes(1);
		expect(commits[6]).not.toHaveBeenCalled();
		expect(commits[7]).not.toHaveBeenCalled();

		// 下一分片帧排空剩余两个
		vi.advanceTimersByTime(16);
		expect(commits[6]).toHaveBeenCalledTimes(1);
		expect(commits[7]).toHaveBeenCalledTimes(1);
		for (const c of commits) expect(c).toHaveBeenCalledTimes(1);
	});

	it("取消函数把提交移出 VT 队列，VT 结束后不再执行", async () => {
		vtActive = true;
		const commit = vi.fn();
		const cancel = mod.commitAfterViewTransition(commit);
		cancel();

		vtActive = false;
		vi.advanceTimersByTime(100);
		await Promise.resolve();
		expect(commit).not.toHaveBeenCalled();
	});

	it("列表被重新入队后取消旧的：只执行最新提交", async () => {
		vtActive = true;
		const first = vi.fn();
		const second = vi.fn();
		const cancelFirst = mod.commitAfterViewTransition(first);
		mod.commitAfterViewTransition(second);

		// 依赖变化：旧提交取消，新提交保留
		cancelFirst();
		vtActive = false;
		vi.advanceTimersByTime(16);
		await Promise.resolve();
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledTimes(1);
	});

	it("伪类始终命中时 1500ms 兜底强制排空，不会永挂骨架", async () => {
		vtActive = true;
		const commits = Array.from({ length: 8 }, () => vi.fn());
		for (const c of commits) mod.commitAfterViewTransition(c);

		// 伪类一直为 true：轮询永远看不到结束
		vi.advanceTimersByTime(1400);
		expect(commits[0]).not.toHaveBeenCalled();

		// 到达 MAX_WAIT_MS=1500：强制放行第一片，剩余逐帧排空
		vi.advanceTimersByTime(100);
		for (const c of commits.slice(0, 6)) expect(c).toHaveBeenCalledTimes(1);
		expect(commits[6]).not.toHaveBeenCalled();

		vi.advanceTimersByTime(16);
		expect(commits[6]).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(16);
		expect(commits[7]).toHaveBeenCalledTimes(1);
		for (const c of commits) expect(c).toHaveBeenCalledTimes(1);
	});

	it("SSR（无 window）时同步提交，即使伪类看似活跃", () => {
		const commit = vi.fn();
		vi.stubGlobal("window", undefined);
		vtActive = true;
		const cancel = mod.commitAfterViewTransition(commit);

		expect(commit).toHaveBeenCalledTimes(1);
		cancel();
		vi.unstubAllGlobals();
	});
});
