// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	anchorScrollTop,
	centerScrollTop,
	scrollElementToCenter,
	scrollElementToTop,
} from "./anchor-scroll";

/** 手动驱动的 rAF 帧队列：逐帧确认是插值滑过去，而不是一次跳到终点 */
let frames: FrameRequestCallback[];

function nextFrame(now: number) {
	frames.shift()?.(now);
}

const scrollTo = vi.fn();

/** 造一个「在文档里、顶边在 top、高 height」的锚点元素（jsdom 没有布局，rect 只能自己给） */
function mountAnchor(top: number, height = 0) {
	const el = document.createElement("div");
	document.body.appendChild(el);
	el.getBoundingClientRect = () => ({ top, height }) as unknown as DOMRect;
	return el;
}

function scrolledTops(): number[] {
	return scrollTo.mock.calls.map(([arg]) => (arg as { top: number }).top);
}

beforeEach(() => {
	frames = [];
	scrollTo.mockClear();
	vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
		frames.push(cb);
		return frames.length;
	});
	vi.stubGlobal("cancelAnimationFrame", () => {});
	vi.stubGlobal("scrollTo", scrollTo);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	document.body.innerHTML = "";
	document.documentElement.style.scrollPaddingTop = "";
});

describe("scrollElementToTop 缓慢滚动", () => {
	it("逐帧插值，最后一帧精确落到锚点", () => {
		const el = mountAnchor(600);
		scrollElementToTop(el);
		expect(frames).toHaveLength(1);

		nextFrame(0);
		nextFrame(180);
		nextFrame(360);
		nextFrame(540);
		nextFrame(720);

		// 中途每一帧都在动（不是 0 → 600 的一步到位）
		expect(scrolledTops()).toEqual([0, 37.5, 300, 562.5, 600]);
		// 到站后不再排队
		expect(frames).toHaveLength(0);
	});

	it("每帧重算终点：动画期间锚点被上方内容推下去，落点跟着走", () => {
		const el = mountAnchor(600);
		scrollElementToTop(el);
		nextFrame(0);

		el.getBoundingClientRect = () => ({ top: 660 }) as unknown as DOMRect;
		nextFrame(360);
		nextFrame(720);

		expect(scrolledTops().at(-1)).toBe(660);
	});

	it("让位 html 的 scroll-padding-top（固定顶栏），与 block:start 一致", () => {
		document.documentElement.style.scrollPaddingTop = "72px";
		const el = mountAnchor(600);

		expect(anchorScrollTop(el)).toBe(528);

		scrollElementToTop(el);
		nextFrame(0);
		nextFrame(720);
		expect(scrolledTops().at(-1)).toBe(528);
	});

	it("元素在视口上方时夹到 0，不滚成负数", () => {
		expect(anchorScrollTop(mountAnchor(-200))).toBe(0);
	});

	it("prefers-reduced-motion：一次到位，不排队动画帧", () => {
		vi.stubGlobal("matchMedia", (query: string) => ({
			matches: query.includes("prefers-reduced-motion"),
			media: query,
		}));

		const el = mountAnchor(600);
		scrollElementToTop(el);

		expect(frames).toHaveLength(0);
		expect(scrolledTops()).toEqual([600]);
	});

	it("用户中途滚轮：立刻让位，不再写滚动位置", () => {
		const el = mountAnchor(600);
		scrollElementToTop(el);
		nextFrame(0);
		nextFrame(180);
		const written = scrolledTops().length;

		window.dispatchEvent(new WheelEvent("wheel"));
		// 已排的那一帧即使被调度器叫醒，也不会再动滚动
		nextFrame(360);
		expect(scrolledTops()).toHaveLength(written);
	});

	it("已经贴在上沿：不演空动画（首帧发现到了就收手）", () => {
		scrollElementToTop(mountAnchor(0));
		nextFrame(0);
		expect(frames).toHaveLength(0);
		expect(scrollTo).not.toHaveBeenCalled();
	});

	it("居中定位（下载按钮定位文件列表）：中线对到视口中线", () => {
		// jsdom 视口高 768：(768 - 400) / 2 = 184
		const el = mountAnchor(2000, 400);
		expect(centerScrollTop(el)).toBe(1816);

		scrollElementToCenter(el);
		nextFrame(0);
		nextFrame(720);
		expect(scrolledTops().at(-1)).toBe(1816);
	});

	it("元素已从文档移除：动画自行停止", () => {
		const el = mountAnchor(600);
		scrollElementToTop(el);
		nextFrame(0);
		el.remove();
		nextFrame(180);
		expect(scrolledTops()).toEqual([0]);
		expect(frames).toHaveLength(0);
	});
});
