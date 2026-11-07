import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WalkthroughListPage } from "./walkthrough-list-page";

// Link 在真实应用里由 furin 的路由上下文提供，单测里换成裸 <a>，
// 断言 href 就够了（与 game-detail-pending.test.tsx 同一套 mock）；
// lastProps 额外保留完整 props，用来断言攻略卡传了 resetScroll=false。
const routerMock = vi.hoisted(() => ({
	pathname: "/v15/walkthrough",
	lastProps: null as Record<string, unknown> | null,
}));

vi.mock("@web/lib/nav", async () => {
	const { createElement } = await import("react");
	type Params = Record<string, string> | undefined;
	return {
		Link: (props: { to: string; params?: Params; children?: unknown }) => {
			routerMock.lastProps = props as unknown as Record<string, unknown>;
			let href = props.to;
			for (const [key, value] of Object.entries(props.params ?? {})) {
				href = href.replace(`:${key}`, value);
			}
			return createElement("a", { href }, props.children as never);
		},
		usePathname: () => routerMock.pathname,
	};
});

beforeEach(() => {
	routerMock.pathname = "/v15/walkthrough";
	routerMock.lastProps = null;
});

/** 与后端 GameWalkthroughsResult 同形：列表项没有 chart（spec 就是这么切的） */
const listData = {
	gameId: "v15",
	workId: "15",
	items: [
		{
			id: "2804",
			workId: "15",
			lang: "ja",
			source: "seiya",
			sourceUrl: "https://saiga.example/wt.html",
			sourceAuthor: null,
			sourceUpdatedOn: "2020-02-15",
			workContentLimit: "sfw",
			workRouteHints: false,
			release: null,
			characters: [
				{ key: "c1", name: "朝武芳乃" },
				{ key: "c2", name: "常陆茉子" },
			],
			endingCount: 13,
			saveCount: 7,
			segmentCount: 15,
			upstreamUpdatedAt: "2026-11-01T10:00:00.000Z",
		},
	],
};

describe("WalkthroughListPage", () => {
	it("渲染攻略卡：语言徽章、计数、来源署名与更新时间", () => {
		const html = renderToString(
			<WalkthroughListPage data={listData} gameId="v15" />,
		);
		expect(html).toContain("日文攻略");
		expect(html).toContain("13 个结局 · 7 个存档点 · 2 名角色");
		// 来源展示名与概览卡同源：署名缺失时退到外链域名，不显示裸 slug
		expect(html).toContain("整理自 saiga.example");
		expect(html).toContain("更新于 2026-11-01");
		// 详情链接要把两个动态段都填进去
		expect(html).toContain('href="/v15/walkthrough/2804"');
		// 关掉 furin 的滚动复位：进详情后的页签锚定由布局钩子负责，
		// 复位晚于页内 layout effect，会把锚定覆盖掉
		expect(routerMock.lastProps?.resetScroll).toBe(false);
	});

	it("没有攻略时给空态，而不是空列表", () => {
		const html = renderToString(
			<WalkthroughListPage
				data={{ gameId: "v15", workId: null, items: [] }}
				gameId="v15"
			/>,
		);
		expect(html).toContain("暂无攻略");
		expect(html).not.toContain("日文攻略");
	});
});
