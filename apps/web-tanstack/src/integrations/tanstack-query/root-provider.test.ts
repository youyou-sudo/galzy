import { afterEach, describe, expect, it, vi } from "vitest";
import { shouldPersistQuery } from "./root-provider";

// 回归：进行中的查询也会被 dehydrate 成 { state, promise }，promise 进不了 JSON
// （序列化成 {}），下次 hydrate 调 promise.then 直接抛错并丢弃整份缓存。
describe("shouldPersistQuery", () => {
	it("持久化已成功的白名单查询", () => {
		expect(
			shouldPersistQuery({
				queryKey: ["totalCount"],
				state: { status: "success" },
			}),
		).toBe(true);
	});

	it("跳过进行中/失败的查询", () => {
		expect(
			shouldPersistQuery({
				queryKey: ["totalCount"],
				state: { status: "pending" },
			}),
		).toBe(false);
		expect(
			shouldPersistQuery({
				queryKey: ["gameList"],
				state: { status: "error" },
			}),
		).toBe(false);
	});

	it("跳过不在白名单里的 key", () => {
		expect(
			shouldPersistQuery({
				queryKey: ["auth"],
				state: { status: "success" },
			}),
		).toBe(false);
	});
});

/** UA 过渡伪元素动画的最小替身：用真实类做原型，供 instanceof KeyframeEffect 判断 */
class FakeKeyframeEffect {
	pseudoElement: string | null;

	constructor(pseudoElement: string | null) {
		this.pseudoElement = pseudoElement;
	}
}

/** 构造最小 document 替身：只实现 VT 探测用到的两个接口 */
function stubDocument(
	options: {
		matches?: (selector: string) => boolean;
		getAnimations?: () => unknown[];
	} = {},
) {
	const documentElement = { matches: vi.fn(options.matches ?? (() => false)) };
	const getAnimations = vi.fn(options.getAnimations ?? (() => []));
	vi.stubGlobal("document", { documentElement, getAnimations });
	return { documentElement, getAnimations };
}

/** 伪类支持检测是模块级缓存，每个用例重新求值模块以隔离缓存 */
async function loadProbe() {
	vi.resetModules();
	const mod = await import("./root-provider");
	return mod.isViewTransitionPlaying;
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("isViewTransitionPlaying（flush 前的 VT 探测）", () => {
	it("伪类可用时只做一次 matches，不再全量枚举动画", async () => {
		const supports = vi.fn(() => true);
		vi.stubGlobal("CSS", { supports });
		const { documentElement, getAnimations } = stubDocument({
			matches: (selector) => selector === ":active-view-transition",
		});

		const probe = await loadProbe();

		expect(probe()).toBe(true);
		expect(documentElement.matches).toHaveBeenCalledWith(
			":active-view-transition",
		);

		// 不在过渡中同样不枚举动画；廉价路径完全不碰 getAnimations
		documentElement.matches.mockReturnValue(false);
		expect(probe()).toBe(false);
		expect(getAnimations).not.toHaveBeenCalled();

		// 支持检测是模块级缓存：多探几次也只问一次 CSS.supports
		expect(supports).toHaveBeenCalledTimes(1);
	});

	it("伪类不可用时回退全量枚举，判据与旧实现等价", async () => {
		vi.stubGlobal("CSS", { supports: () => false });
		vi.stubGlobal("KeyframeEffect", FakeKeyframeEffect);
		const getAnimations = vi.fn<() => unknown[]>(() => [
			{ effect: new FakeKeyframeEffect(null) },
			{ effect: new FakeKeyframeEffect("::view-transition-group(root)") },
		]);
		stubDocument({ getAnimations });

		const probe = await loadProbe();

		expect(probe()).toBe(true);
		expect(getAnimations).toHaveBeenCalledTimes(1);

		// 非过渡伪元素 / 非 KeyframeEffect 动画按旧判据忽略
		getAnimations.mockReturnValue([
			{ effect: new FakeKeyframeEffect("::before") },
			{ effect: null },
			{},
		]);
		expect(probe()).toBe(false);

		// 枚举本身抛错时沿用旧实现的 try/catch，返回 false
		getAnimations.mockImplementation(() => {
			throw new Error("getAnimations 不可用");
		});
		expect(probe()).toBe(false);
	});

	it("CSS.supports 抛错时按不支持处理，回退动画枚举", async () => {
		vi.stubGlobal("CSS", {
			supports: () => {
				throw new Error("CSS.supports 不可用");
			},
		});
		vi.stubGlobal("KeyframeEffect", FakeKeyframeEffect);
		stubDocument({
			getAnimations: () => [
				{ effect: new FakeKeyframeEffect("::view-transition-new(root)") },
			],
		});

		const probe = await loadProbe();

		expect(probe()).toBe(true);
	});

	it("无 document / 无 CSS（SSR、node 测试环境）时安全降级为 false", async () => {
		// 不 stub 任何全局：node 测试环境既无 document 也无 CSS
		const probe = await loadProbe();

		expect(probe()).toBe(false);
	});
});
