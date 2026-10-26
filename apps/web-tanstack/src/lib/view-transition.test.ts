import { describe, expect, it, vi } from "vitest";
import {
	createViewTransitionWrapper,
	getActiveViewTransition,
	MAX_REWRITE_GROUPS,
	makeGroupCompositorKeyframes,
	readGroupRewriteSignals,
	rewriteGroupAnimations,
	shouldSkipGroupRewrite,
	waitForViewTransitionEnd,
} from "./view-transition";

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

	it("改写上限存在且为正数：group 爆炸时导航动画改写有界", () => {
		expect(MAX_REWRITE_GROUPS).toBeGreaterThan(0);
	});
});

describe("waitForViewTransitionEnd（VT 结束后收尾）", () => {
	it("无 document（SSR/Node）时不挂起，直接 resolve", async () => {
		// 本仓库测试环境为 node（无 jsdom），document 未定义 →
		// 该帮助函数必须优雅降级，调用方在服务端渲染/测试中不应等待。
		await expect(waitForViewTransitionEnd()).resolves.toBeUndefined();
	});

	it("getActiveViewTransition 暴露稳定 API（无过渡时为 undefined）", () => {
		expect(getActiveViewTransition()).toBeUndefined();
	});
});

/** 桌面 + 支持 view-transition-class 的常态环境（不触发任何短路） */
const DESKTOP_SIGNALS = {
	coarsePointer: false,
	viewTransitionClassSupported: true,
	reducedMotion: false,
};

/** 共享元素桩：style 用普通对象模拟（node 环境没有 DOM 构造器） */
function fakeSharedElement(
	name: string,
	rect: { width: number; height: number } = { width: 84, height: 28 },
) {
	const getBoundingClientRect = vi.fn(() => rect);
	return {
		style: { viewTransitionName: name, viewTransitionClass: "" },
		getBoundingClientRect,
	};
}

type FakeSharedElement = ReturnType<typeof fakeSharedElement>;

/** VT group 动画桩：只实现本模块用到的 KeyframeEffect 片段 */
function fakeGroupAnimation(
	name: string,
	keyframes: () => Keyframe[],
	target: unknown,
) {
	let written: Keyframe[] | undefined;
	const setKeyframes = vi.fn((frames: Keyframe[]) => {
		written = frames;
	});
	return {
		effect: {
			pseudoElement: `::view-transition-group(${name})`,
			target,
			getKeyframes: () => keyframes(),
			setKeyframes,
		},
		setKeyframes,
		writtenFrames: () => written,
	};
}

type FakeGroupAnimation = ReturnType<typeof fakeGroupAnimation>;

/** document 桩：getAnimations / querySelectorAll 均为 spy */
function fakeDocument(
	animations: FakeGroupAnimation[],
	shared: FakeSharedElement[] = [],
) {
	return {
		getAnimations: vi.fn(() => animations),
		querySelectorAll: vi.fn(() => shared),
	};
}

describe("shouldSkipGroupRewrite（styles.css 覆盖场景短路）", () => {
	it("prefers-reduced-motion: reduce → 跳过（group duration 0s，动画不播）", () => {
		expect(
			shouldSkipGroupRewrite({
				coarsePointer: false,
				viewTransitionClassSupported: true,
				reducedMotion: true,
			}),
		).toBe(true);
	});

	it("触屏 + 不支持 view-transition-class → 跳过（group(*) 被纯 opacity 淡入覆盖）", () => {
		expect(
			shouldSkipGroupRewrite({
				coarsePointer: true,
				viewTransitionClassSupported: false,
				reducedMotion: false,
			}),
		).toBe(true);
	});

	it("触屏 + 支持 view-transition-class → 照常改写（保留共享元素飞行）", () => {
		expect(
			shouldSkipGroupRewrite({
				coarsePointer: true,
				viewTransitionClassSupported: true,
				reducedMotion: false,
			}),
		).toBe(false);
	});

	it("桌面 + 不支持 view-transition-class → 照常改写（@supports 在非粗指针下不生效）", () => {
		expect(
			shouldSkipGroupRewrite({
				coarsePointer: false,
				viewTransitionClassSupported: false,
				reducedMotion: false,
			}),
		).toBe(false);
	});

	it("无 matchMedia/CSS（node、SSR）时取保守值且不抛错", () => {
		const signals = readGroupRewriteSignals();

		expect(signals).toEqual({
			coarsePointer: false,
			viewTransitionClassSupported: false,
			reducedMotion: false,
		});
		expect(shouldSkipGroupRewrite(signals)).toBe(false);
	});
});

describe("rewriteGroupAnimations（扫描与测量成本）", () => {
	it("effect.target 命中共享元素时完全不调用 document.querySelectorAll", () => {
		const el = fakeSharedElement("cover-v123");
		const group = fakeGroupAnimation("cover-v123", oldUaKeyframes, el);
		const doc = fakeDocument([group]);

		rewriteGroupAnimations(doc as unknown as Document, DESKTOP_SIGNALS);

		expect(doc.querySelectorAll).not.toHaveBeenCalled();
		expect(el.getBoundingClientRect).toHaveBeenCalledTimes(1);
		expect(group.setKeyframes).toHaveBeenCalledTimes(1);
	});

	it("关键帧不含 width/height（新版 UA）时不测量尺寸", () => {
		const el = fakeSharedElement("cover-v123");
		const group = fakeGroupAnimation("cover-v123", newUaKeyframes, el);
		const doc = fakeDocument([group]);

		rewriteGroupAnimations(doc as unknown as Document, DESKTOP_SIGNALS);

		expect(el.getBoundingClientRect).not.toHaveBeenCalled();
		expect(doc.querySelectorAll).not.toHaveBeenCalled();
		expect(group.setKeyframes).toHaveBeenCalledTimes(1);
		// 新版 UA 不追加 scale（防止双重缩放）
		expect(group.writtenFrames()?.[0]?.transform).toBe(
			"matrix(1, 0, 0, 1, 40, 195) scale(1.427, 1.028)",
		);
	});

	it("旧版 UA 形态才用实测新尺寸折算 scale", () => {
		const el = fakeSharedElement("cover-v123", { width: 84, height: 28 });
		const group = fakeGroupAnimation("cover-v123", oldUaKeyframes, el);
		const doc = fakeDocument([group]);

		rewriteGroupAnimations(doc as unknown as Document, DESKTOP_SIGNALS);

		expect(el.getBoundingClientRect).toHaveBeenCalledTimes(1);
		expect(group.writtenFrames()?.[0]?.transform).toBe(
			`translate(40px, 195px) scale(${120 / 84}, ${28.8 / 28})`,
		);
	});

	it("命中短路分支时连 getAnimations 都不调用", () => {
		const doc = fakeDocument([]);

		rewriteGroupAnimations(doc as unknown as Document, {
			...DESKTOP_SIGNALS,
			reducedMotion: true,
		});

		expect(doc.getAnimations).not.toHaveBeenCalled();
	});

	it("target 不匹配（UA 指向根元素）时回退 DOM 扫描，多个 group 只扫一次", () => {
		const el = fakeSharedElement("cover-v123");
		const first = fakeGroupAnimation("cover-v123", oldUaKeyframes, {
			style: { viewTransitionName: "" },
		});
		const second = fakeGroupAnimation("cover-v123", oldUaKeyframes, null);
		const doc = fakeDocument([first, second], [el]);

		rewriteGroupAnimations(doc as unknown as Document, DESKTOP_SIGNALS);

		expect(doc.querySelectorAll).toHaveBeenCalledTimes(1);
		expect(first.setKeyframes).toHaveBeenCalledTimes(1);
		expect(second.setKeyframes).toHaveBeenCalledTimes(1);
	});

	it("文字类 group 跳过改写且不测量尺寸", () => {
		const el = fakeSharedElement("game-title-v123");
		const group = fakeGroupAnimation("game-title-v123", oldUaKeyframes, el);
		const doc = fakeDocument([group]);

		rewriteGroupAnimations(doc as unknown as Document, DESKTOP_SIGNALS);

		expect(group.setKeyframes).not.toHaveBeenCalled();
		expect(el.getBoundingClientRect).not.toHaveBeenCalled();
	});

	it("root group 不解析元素、不测量，只删 width/height", () => {
		const group = fakeGroupAnimation("root", newUaKeyframes, null);
		const doc = fakeDocument([group]);

		rewriteGroupAnimations(doc as unknown as Document, DESKTOP_SIGNALS);

		expect(doc.querySelectorAll).not.toHaveBeenCalled();
		expect(group.setKeyframes).toHaveBeenCalledTimes(1);
	});
});

/** 真实 VT 桩：ready 已就绪，finished 由测试手动 settle */
function fakeTransition() {
	let settleFinished: () => void = () => {};
	const finished = new Promise<void>((resolve) => {
		settleFinished = resolve;
	});
	const skipTransition = vi.fn();
	return {
		transition: {
			ready: Promise.resolve(),
			finished,
			updateCallbackDone: Promise.resolve(),
			skipTransition,
		} as unknown as ViewTransition,
		skipTransition,
		settle: () => settleFinished(),
	};
}

/** document 桩：记录监听器，支持派发与计数（node 环境无 DOM 构造器） */
function fakeInputDocument() {
	const listeners = new Map<string, EventListener[]>();
	const addEventListener = vi.fn((type: string, listener: EventListener) => {
		const list = listeners.get(type) ?? [];
		list.push(listener);
		listeners.set(type, list);
	});
	const removeEventListener = vi.fn((type: string, listener: EventListener) => {
		const list = listeners.get(type) ?? [];
		listeners.set(
			type,
			list.filter((item) => item !== listener),
		);
	});
	const dispatch = (type: string) => {
		for (const listener of listeners.get(type) ?? []) {
			listener(new Event(type));
		}
	};
	return {
		doc: { addEventListener, removeEventListener } as unknown as Document,
		addEventListener,
		removeEventListener,
		dispatch,
		listenerCount: () =>
			[...listeners.values()].reduce((total, list) => total + list.length, 0),
	};
}

describe("createViewTransitionWrapper（reduced-motion 直通）", () => {
	it("命中 prefers-reduced-motion：不调用原生 start，只跑 update 回调", async () => {
		const env = fakeInputDocument();
		const start = vi.fn();
		const update = vi.fn();
		const wrapper = createViewTransitionWrapper({
			doc: env.doc,
			start,
			prefersReducedMotion: () => true,
		});

		const transition = wrapper(update);

		expect(start).not.toHaveBeenCalled();
		// 直通路径不挂输入打断监听（没有快照覆盖层可打断）
		expect(env.addEventListener).not.toHaveBeenCalled();

		await transition.updateCallbackDone;
		expect(update).toHaveBeenCalledTimes(1);

		await expect(transition.ready).resolves.toBeUndefined();
		await expect(transition.finished).resolves.toBeUndefined();

		// 不写入 activeTransition，skipTransition 空实现不抛
		expect(getActiveViewTransition()).toBeUndefined();
		expect(() => transition.skipTransition()).not.toThrow();
	});

	it("兼容 { update, types } 参数形态", async () => {
		const env = fakeInputDocument();
		const start = vi.fn();
		const update = vi.fn();
		const wrapper = createViewTransitionWrapper({
			doc: env.doc,
			start,
			prefersReducedMotion: () => true,
		});

		const transition = wrapper({ update, types: ["nav"] });

		await transition.updateCallbackDone;
		expect(update).toHaveBeenCalledTimes(1);
		expect(start).not.toHaveBeenCalled();
	});

	it("update 回调异常原样透传到 updateCallbackDone（不吞掉）", async () => {
		const env = fakeInputDocument();
		const wrapper = createViewTransitionWrapper({
			doc: env.doc,
			start: vi.fn(),
			prefersReducedMotion: () => true,
		});

		const transition = wrapper(() => {
			throw new Error("boom");
		});

		await expect(transition.updateCallbackDone).rejects.toThrow("boom");
		// finished 预消化：不产生未处理的 rejection，仍正常 resolve
		await expect(transition.finished).resolves.toBeUndefined();
	});

	it("生产默认路径：未注入 prefersReducedMotion 时从 matchMedia 读取 reduce", async () => {
		const env = fakeInputDocument();
		const start = vi.fn();
		const update = vi.fn();
		const matchMedia = vi.fn((query: string) => ({
			matches: query === "(prefers-reduced-motion: reduce)",
		}));
		vi.stubGlobal("matchMedia", matchMedia);
		try {
			const wrapper = createViewTransitionWrapper({ doc: env.doc, start });
			const transition = wrapper(update);

			expect(matchMedia).toHaveBeenCalledWith(
				"(prefers-reduced-motion: reduce)",
			);
			expect(start).not.toHaveBeenCalled();
			await transition.updateCallbackDone;
			expect(update).toHaveBeenCalledTimes(1);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

describe("createViewTransitionWrapper（正常路径 + 用户输入打断）", () => {
	function setup() {
		const env = fakeInputDocument();
		const fake = fakeTransition();
		const start = vi.fn(() => fake.transition);
		const wrapper = createViewTransitionWrapper({
			doc: env.doc,
			start,
			prefersReducedMotion: () => false,
		});
		return { env, fake, start, wrapper };
	}

	it("正常路径：调用原生 start、写入 activeTransition、结束后清理", async () => {
		const { fake, start, wrapper } = setup();
		const callback = vi.fn();

		const transition = wrapper(callback);

		expect(start).toHaveBeenCalledWith(callback);
		expect(transition).toBe(fake.transition);
		expect(getActiveViewTransition()).toBe(fake.transition);

		fake.settle();
		await transition.finished;
		expect(getActiveViewTransition()).toBeUndefined();
	});

	it("监听以 capture + passive + once 挂在 document 上（原生 start 之后）", () => {
		const { env, start, wrapper } = setup();

		wrapper(() => {});

		for (const type of ["pointerdown", "touchstart", "wheel", "keydown"]) {
			expect(env.addEventListener).toHaveBeenCalledWith(
				type,
				expect.any(Function),
				{ capture: true, passive: true, once: true },
			);
		}
		// 起始手势的 pointerdown 已派发过，必须在 start 之后再挂监听
		expect(env.addEventListener.mock.invocationCallOrder[0]).toBeGreaterThan(
			start.mock.invocationCallOrder[0],
		);
	});

	it.each(["pointerdown", "touchstart", "wheel", "keydown"])(
		"%s 立即触发一次 skipTransition 并清理其余监听",
		(type) => {
			const { env, fake, wrapper } = setup();
			wrapper(() => {});

			env.dispatch(type);

			expect(fake.skipTransition).toHaveBeenCalledTimes(1);
			expect(env.removeEventListener).toHaveBeenCalledTimes(4);
			expect(env.listenerCount()).toBe(0);
		},
	);

	it("只打断一次：后续输入不再触发 skipTransition", () => {
		const { env, fake, wrapper } = setup();
		wrapper(() => {});

		env.dispatch("pointerdown");
		env.dispatch("wheel");
		env.dispatch("keydown");

		expect(fake.skipTransition).toHaveBeenCalledTimes(1);
	});

	it("finished 后监听全部清理（再派发不触发）", async () => {
		const { env, fake, wrapper } = setup();
		const transition = wrapper(() => {});
		expect(env.listenerCount()).toBe(4);

		fake.settle();
		await transition.finished;

		expect(env.removeEventListener).toHaveBeenCalledTimes(4);
		expect(env.listenerCount()).toBe(0);
		env.dispatch("pointerdown");
		expect(fake.skipTransition).not.toHaveBeenCalled();
	});

	it("skipTransition 抛错被吞掉（try/catch，不打断输入处理）", () => {
		const env = fakeInputDocument();
		const transition = {
			ready: Promise.resolve(),
			finished: Promise.resolve(),
			updateCallbackDone: Promise.resolve(),
			skipTransition: vi.fn(() => {
				throw new Error("already skipped");
			}),
		} as unknown as ViewTransition;
		const wrapper = createViewTransitionWrapper({
			doc: env.doc,
			start: () => transition,
			prefersReducedMotion: () => false,
		});

		wrapper(() => {});

		expect(() => env.dispatch("pointerdown")).not.toThrow();
		expect(transition.skipTransition).toHaveBeenCalledTimes(1);
	});

	it("残缺环境（doc 无 addEventListener）不崩", async () => {
		const fake = fakeTransition();
		const wrapper = createViewTransitionWrapper({
			doc: {} as unknown as Document,
			start: () => fake.transition,
			prefersReducedMotion: () => false,
		});

		const transition = wrapper(() => {});
		expect(transition).toBe(fake.transition);
		expect(getActiveViewTransition()).toBe(fake.transition);

		fake.settle();
		await transition.finished;
		expect(getActiveViewTransition()).toBeUndefined();
	});
});
