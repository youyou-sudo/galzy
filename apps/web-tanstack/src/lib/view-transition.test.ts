import { describe, expect, it } from "vitest";
import { makeGroupCompositorKeyframes } from "./view-transition";

/**
 * 旧版 UA 形态（spec §3.9.5）：from 只有位移 transform，尺寸 morph 由
 * width/height 承担；终点值来自 group 内联样式。getKeyframes() 返回时
 * 补出隐式 to 关键帧（其 width/height 可能携带错误值，故以实测尺寸为准）。
 */
function oldUaKeyframes() {
	return [
		{
			offset: 0,
			transform: "translate(40px, 195px)",
			width: "120px",
			height: "28.8px",
		},
		{
			offset: 1,
			transform: "matrix(1, 0, 0, 1, 50, 647)",
			width: "120px",
			height: "28.8px",
		},
	] as Keyframe[];
}

/**
 * 新版 UA 形态：尺寸已折算进 from 的 transform scale，关键帧不含
 * width/height（实测确认 Chrome 当前行为）。
 */
function newUaKeyframes() {
	return [
		{
			offset: 0,
			transform: "matrix(1, 0, 0, 1, 40, 195) scale(1.427, 1.028)",
		},
		{ offset: 1 },
	] as Keyframe[];
}

describe("makeGroupCompositorKeyframes（compositor-only 改写）", () => {
	it("删除所有 width/height —— group 动画不再跑主线程 layout", () => {
		const keyframes = oldUaKeyframes();
		makeGroupCompositorKeyframes(keyframes, "game-title-v123", 84, 28);

		for (const frame of keyframes) {
			expect(frame).not.toHaveProperty("width");
			expect(frame).not.toHaveProperty("height");
		}
	});

	it("旧版 UA：尺寸 morph 折算成 from 的 transform scale（用实测新尺寸，不信隐式 to）", () => {
		const keyframes = oldUaKeyframes();
		makeGroupCompositorKeyframes(keyframes, "game-title-v123", 84, 28);

		expect(keyframes[0].transform).toBe(
			`translate(40px, 195px) scale(${120 / 84}, ${28.8 / 28})`,
		);
	});

	it("新版 UA：关键帧已带 scale，不再追加（防止双重缩放）", () => {
		const keyframes = newUaKeyframes();
		makeGroupCompositorKeyframes(keyframes, "game-title-v123", 84, 28);

		expect(keyframes[0].transform).toBe(
			"matrix(1, 0, 0, 1, 40, 195) scale(1.427, 1.028)",
		);
	});

	it("删除 to 关键帧的 transform —— 末帧回落到浏览器内联 transform，不错位", () => {
		const keyframes = oldUaKeyframes();
		makeGroupCompositorKeyframes(keyframes, "game-title-v123", 84, 28);

		expect(keyframes[1].transform).toBeUndefined();
	});

	it("root group 只删 width/height，不追加 scale", () => {
		const keyframes = [
			{
				offset: 0,
				transform: "translate3d(0, 0, 0) scale(1)",
				width: "100%",
				height: "100%",
			},
			{ offset: 1, transform: "matrix(1, 0, 0, 1, 0, 0)" },
		] as Keyframe[];

		makeGroupCompositorKeyframes(keyframes, "root", 100, 100);

		expect(keyframes[0].transform).toBe("translate3d(0, 0, 0) scale(1)");
		expect(keyframes[0]).not.toHaveProperty("width");
		expect(keyframes[0]).not.toHaveProperty("height");
	});

	it("尺寸不变的共享元素（头像/昵称）只做位移，不追加 scale", () => {
		const keyframes = oldUaKeyframes();
		makeGroupCompositorKeyframes(keyframes, "topic-avatar-42", 120, 28.8);

		expect(keyframes[0].transform).toBe("translate(40px, 195px)");
		expect(keyframes[0]).not.toHaveProperty("width");
		expect(keyframes[0]).not.toHaveProperty("height");
	});

	it("新元素尺寸缺失时安全降级：不追加 scale，仅删 width/height", () => {
		const keyframes = oldUaKeyframes();
		makeGroupCompositorKeyframes(keyframes, "game-title-v123", 0, 0);

		expect(keyframes[0].transform).toBe("translate(40px, 195px)");
		expect(keyframes[0]).not.toHaveProperty("width");
		expect(keyframes[0]).not.toHaveProperty("height");
	});
});
