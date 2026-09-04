import { describe, expect, it } from "vitest";
import { makeGroupCompositorKeyframes } from "./view-transition";

/**
 * UA 生成的共享元素 group 关键帧形态（spec §3.9.5）：
 * 只有 from 块（旧盒子几何），终点值来自 group 内联样式（新盒子几何），
 * getKeyframes() 返回时补出隐式 to 关键帧。
 */
function sharedElementKeyframes(): Keyframe[] {
	return [
		{
			offset: 0,
			transform: "translate(16px, 180px)",
			width: "200px",
			height: "266px",
		},
		{
			offset: 1,
			transform: "matrix(1, 0, 0, 1, 16, 0)",
			width: "220px",
			height: "293px",
		},
	] as Keyframe[];
}

describe("makeGroupCompositorKeyframes（compositor-only 改写）", () => {
	it("删除所有 width/height —— group 动画不再跑主线程 layout", () => {
		const keyframes = sharedElementKeyframes();
		makeGroupCompositorKeyframes(keyframes, "game-cover-v123");

		for (const frame of keyframes) {
			expect(frame).not.toHaveProperty("width");
			expect(frame).not.toHaveProperty("height");
		}
	});

	it("尺寸 morph 折算成 from 关键帧的 transform scale，保留浏览器自己的位移", () => {
		const keyframes = sharedElementKeyframes();
		makeGroupCompositorKeyframes(keyframes, "game-cover-v123");

		expect(keyframes[0].transform).toBe(
			`translate(16px, 180px) scale(${200 / 220}, ${266 / 293})`,
		);
	});

	it("删除 to 关键帧的 transform —— 末帧回落到浏览器内联 transform，不错位", () => {
		const keyframes = sharedElementKeyframes();
		makeGroupCompositorKeyframes(keyframes, "game-cover-v123");

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
			{
				offset: 1,
				transform: "matrix(1, 0, 0, 1, 0, 0)",
				width: "100%",
				height: "100%",
			},
		] as Keyframe[];

		makeGroupCompositorKeyframes(keyframes, "root");

		expect(keyframes[0].transform).toBe("translate3d(0, 0, 0) scale(1)");
		expect(keyframes[0]).not.toHaveProperty("width");
		expect(keyframes[0]).not.toHaveProperty("height");
	});

	it("尺寸不变的共享元素（头像/昵称）只做位移，不追加 scale", () => {
		const keyframes = [
			{
				offset: 0,
				transform: "translate(100px, 200px)",
				width: "24px",
				height: "24px",
			},
			{
				offset: 1,
				transform: "matrix(1, 0, 0, 1, 100, 0)",
				width: "24px",
				height: "24px",
			},
		] as Keyframe[];

		makeGroupCompositorKeyframes(keyframes, "topic-avatar-42");

		expect(keyframes[0].transform).toBe("translate(100px, 200px)");
		expect(keyframes[0]).not.toHaveProperty("width");
		expect(keyframes[0]).not.toHaveProperty("height");
	});
});
