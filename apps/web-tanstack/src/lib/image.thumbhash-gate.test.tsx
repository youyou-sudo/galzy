// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getThumbHashDataUrl, useThumbHashDataUrl } from "./image";

/** 固定解码结果：jsdom 无 canvas，thumbhash 真实实现必然抛错、结果为 null，
 * 而 null 与「本来就还没解出」在 UI 上无法区分，没法断言提交是否被挂起。
 * 因此把解码器 mock 成固定 data URL，让「结果到达 → 提交被门控」可观测。 */
const thumbhash = vi.hoisted(() => ({
	dataUrl: "data:image/png;base64,THUMBHASH",
}));

vi.mock("thumbhash", () => ({
	thumbHashToDataURL: () => thumbhash.dataUrl,
}));

/** reveal-gate 的替身：忠实实现「未门控同步提交 / 门控中收纳且可取消」，
 * 额外暴露 flush() 让用例手动放行挂起提交（模拟门控解除后的分片 flush）。 */
const gate = vi.hoisted(() => {
	const pending = new Set<() => void>();
	const state = {
		/** 门控窗口开关：true = 滚动 / VT 动画进行中 */
		gated: false,
		/** gateCommit 被调用次数 */
		calls: 0,
		/** gateCommit 返回的 cancel 被调用次数 */
		cancels: 0,
		/** 实际执行过的提交数（同步执行 + flush 执行） */
		executed: 0,
	};

	return {
		state,
		pending,
		gateCommit(commit: () => void): () => void {
			state.calls += 1;
			if (!state.gated) {
				state.executed += 1;
				commit();
				return () => {};
			}
			pending.add(commit);
			return () => {
				state.cancels += 1;
				pending.delete(commit);
			};
		},
		flush() {
			const batch = [...pending];
			pending.clear();
			for (const commit of batch) {
				state.executed += 1;
				commit();
			}
		},
		reset() {
			pending.clear();
			state.gated = false;
			state.calls = 0;
			state.cancels = 0;
			state.executed = 0;
		},
	};
});

vi.mock("./reveal-gate", () => ({ gateCommit: gate.gateCommit }));

/** 每个用例用不同 ThumbHash（模块级缓存是单例，避免互相命中），
 * 且必须是合法 base64（长度 4 的倍数、无需补位），否则 decodeThumbHash
 * 产不出候选字节，结果直接是负缓存 null。 */
const HASH_PENDING = "gatependinga";
const HASH_SYNC = "gatesyncaaaa";
const HASH_UNMOUNT = "gateunmounta";
const HASH_SWITCH_A = "gateswitchaa";
const HASH_SWITCH_B = "gateswitchbb";
const HASH_CACHED = "gatecachedaa";

function Probe({ thumbhash: value }: { thumbhash?: string | null }) {
	const dataUrl = useThumbHashDataUrl(value);
	return <span data-testid="thumbhash">{dataUrl ?? "none"}</span>;
}

/** 推进到主线程兜底解码管线完成通知：jsdom 无 Worker /
 * requestIdleCallback，image.ts 回退 setTimeout(32) 分片 drain。 */
function advanceDecode() {
	act(() => {
		vi.advanceTimersByTime(64);
	});
}

beforeEach(() => {
	vi.useFakeTimers();
	gate.reset();
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe("useThumbHashDataUrl × reveal-gate", () => {
	it("门控中：解码结果到达时不提交，flush 后才更新 UI", () => {
		gate.state.gated = true;
		render(<Probe thumbhash={HASH_PENDING} />);

		advanceDecode();

		// 结果已解出并被门控收纳：UI 仍是初始占位值，提交尚未执行
		expect(screen.getByTestId("thumbhash").textContent).toBe("none");
		expect(gate.pending.size).toBe(1);
		expect(gate.state.executed).toBe(0);

		act(() => {
			gate.flush();
		});
		expect(screen.getByTestId("thumbhash").textContent).toBe(thumbhash.dataUrl);
		expect(gate.state.executed).toBe(1);
	});

	it("未门控：解码结果保持同步提交（与旧行为一致）", () => {
		render(<Probe thumbhash={HASH_SYNC} />);

		advanceDecode();

		expect(screen.getByTestId("thumbhash").textContent).toBe(thumbhash.dataUrl);
		expect(gate.pending.size).toBe(0);
		expect(gate.state.executed).toBe(1);
	});

	it("卸载时取消挂起提交，flush 不再向已卸载组件提交", () => {
		gate.state.gated = true;
		const { unmount } = render(<Probe thumbhash={HASH_UNMOUNT} />);
		advanceDecode();
		expect(gate.pending.size).toBe(1);

		unmount();

		// effect cleanup 主动 cancel：挂起集合清空、cancel 被调用一次
		expect(gate.state.cancels).toBe(1);
		expect(gate.pending.size).toBe(0);

		// 门控解除后的 flush 不得再执行过期提交
		act(() => {
			gate.flush();
		});
		expect(gate.state.executed).toBe(0);
	});

	it("thumbhash 变化时取消上一次挂起提交，只保留新值的提交", () => {
		gate.state.gated = true;
		const { rerender } = render(<Probe thumbhash={HASH_SWITCH_A} />);
		advanceDecode();
		expect(gate.pending.size).toBe(1);

		rerender(<Probe thumbhash={HASH_SWITCH_B} />);
		expect(gate.state.cancels).toBe(1);
		expect(gate.pending.size).toBe(0);

		advanceDecode();
		expect(gate.pending.size).toBe(1);

		act(() => {
			gate.flush();
		});
		expect(screen.getByTestId("thumbhash").textContent).toBe(thumbhash.dataUrl);
		expect(gate.state.executed).toBe(1);
	});

	it("缓存命中（初始值路径）保持同步，不进 reveal-gate", () => {
		gate.state.gated = true;
		const cached = getThumbHashDataUrl(HASH_CACHED);
		expect(cached).toBe(thumbhash.dataUrl);

		render(<Probe thumbhash={HASH_CACHED} />);

		expect(screen.getByTestId("thumbhash").textContent).toBe(cached);
		expect(gate.state.calls).toBe(0);
		expect(gate.state.executed).toBe(0);
		expect(gate.pending.size).toBe(0);
	});
});
