// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GAME_TAB_ANCHOR_ATTR, GameTabs } from "./GameTabs";

// 路由状态用可变对象驱动（与 game-detail-pending.test.tsx 同一套 mock）：
// pathname 是地址栏，committedHref 是 furin **已提交**的路由 —— 锚定只看后者。
const navMock = vi.hoisted(() => ({
	pathname: "/v17",
	committedHref: "/v17",
	linkProps: {} as Record<string, Record<string, unknown>>,
}));

vi.mock("@web/lib/nav", async () => {
	const { createElement } = await import("react");
	type Params = Record<string, string> | undefined;
	return {
		Link: (props: { to: string; params?: Params; children?: unknown }) => {
			navMock.linkProps[props.to] = props as unknown as Record<string, unknown>;
			let href = props.to;
			for (const [key, value] of Object.entries(props.params ?? {})) {
				href = href.replace(`:${key}`, value);
			}
			return createElement("a", { href }, props.children as never);
		},
		usePathname: () => navMock.pathname,
		useRouter: () => ({ currentHref: navMock.committedHref }),
	};
});

/** 记录每次 scrollIntoView 的调用目标与参数（jsdom 没有布局，只能观察调用） */
const scrollCalls: Array<{
	target: HTMLElement;
	options: unknown;
}> = [];

function mount() {
	const view = render(<GameTabs id="v17" />);
	const anchor = view.container.querySelector<HTMLElement>(
		`[${GAME_TAB_ANCHOR_ATTR}]`,
	);
	if (!anchor) throw new Error("页签栏缺少锚点属性");
	return { ...view, anchor };
}

/** 模拟一次「地址栏已变 + furin 已提交」的站内导航 */
function navigate(
	view: ReturnType<typeof mount>,
	href: string,
	{ commit = true } = {},
) {
	navMock.pathname = href;
	if (commit) navMock.committedHref = href;
	view.rerender(<GameTabs id="v17" />);
}

beforeEach(() => {
	navMock.pathname = "/v17";
	navMock.committedHref = "/v17";
	navMock.linkProps = {};
	scrollCalls.length = 0;
	HTMLElement.prototype.scrollIntoView = function (
		this: HTMLElement,
		options?: boolean | ScrollIntoViewOptions,
	) {
		scrollCalls.push({ target: this, options });
	};
});

afterEach(() => {
	cleanup();
});

describe("GameTabs 攻略页签锚定", () => {
	it("页签栏本身就是锚点，首帧不滚动", () => {
		const { anchor } = mount();
		expect(anchor.querySelector('[data-slot="tabs"]')).not.toBeNull();
		for (const href of ['href="/v17"', 'href="/v17/walkthrough"']) {
			expect(anchor.innerHTML).toContain(href);
		}
		expect(scrollCalls).toHaveLength(0);
	});

	it("直达/刷新（首帧就在攻略页）不滚，保持整页落点", () => {
		navMock.pathname = "/v17/walkthrough";
		navMock.committedHref = "/v17/walkthrough";
		mount();
		expect(scrollCalls).toHaveLength(0);
	});

	it("从下载页签切到攻略：把页签栏锚到视口顶部", () => {
		const view = mount();
		navigate(view, "/v17/walkthrough");
		expect(scrollCalls).toHaveLength(1);
		expect(scrollCalls[0]?.target).toBe(view.anchor);
		expect(scrollCalls[0]?.options).toEqual({
			behavior: "instant",
			block: "start",
		});
	});

	it("攻略列表 → 攻略详情：再锚定一次", () => {
		const view = mount();
		navigate(view, "/v17/walkthrough");
		navigate(view, "/v17/walkthrough/2804");
		expect(scrollCalls).toHaveLength(2);
	});

	it("地址栏先变、路由还没提交时不抢跳（后退加载中不会先滚一次）", () => {
		const view = mount();
		navigate(view, "/v17/walkthrough", { commit: false });
		expect(scrollCalls).toHaveLength(0);
		// 提交完成后才锚定
		navMock.committedHref = "/v17/walkthrough";
		view.rerender(<GameTabs id="v17" />);
		expect(scrollCalls).toHaveLength(1);
	});

	it("切到其它页签不滚（保持原有滚动手感）", () => {
		navMock.pathname = "/v17/walkthrough";
		navMock.committedHref = "/v17/walkthrough";
		const view = mount();
		navigate(view, "/v17/comment");
		expect(scrollCalls).toHaveLength(0);
	});

	it("同一已提交路径重渲染（查询/状态更新）不重复滚", () => {
		const view = mount();
		navigate(view, "/v17/walkthrough");
		navigate(view, "/v17/walkthrough");
		expect(scrollCalls).toHaveLength(1);
	});

	it("攻略页签的 Link 取消 furin 的滚动复位", () => {
		mount();
		// 复位在 RouterProvider 的 layout effect 里执行，会晚于页签锚定把位置清零
		expect(navMock.linkProps["/:id/walkthrough"]?.resetScroll).toBe(false);
	});
});
