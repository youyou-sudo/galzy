// @vitest-environment jsdom
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { NavPathProvider, useSearch } from "./nav";

/**
 * 回归测试：`useSearch()` 不能在切页瞬间抛错。
 *
 * 背景（线上 500）：后台点「查看站点」→ 首页 `<SearchInput />` 渲染时调用
 * `useSearch()`。旧实现把「当前路由 pattern」从 `window.location` 反查后交给
 * furin 的 `useSearch(pattern)`，而 furin 的 SearchStore 是切页后异步提交的，
 * 两者在导航瞬间不一致 → `assertSearchRoute` 抛
 * `[furin] useSearch("...") does not match the current route.`
 * → 整页被打成「500 页面出错了」，且错误页点「返回首页」会重抛同一个错，
 * 只有浏览器刷新（文档请求）能恢复。
 *
 * 这里用 SSR 渲染模拟「地址栏已经指向 A、路由 store 还停在别处」的状态：
 * 兼容层只读地址栏（和 SSR 下发的 path/search），不参与 furin 的断言。
 */

function Probe() {
	const search = useSearch() as Record<string, unknown>;
	return <span data-testid="search">{JSON.stringify(search)}</span>;
}

function renderProbe(initialPath?: string, initialSearch?: string): string {
	const tree = <Probe />;
	if (initialPath === undefined) return renderToString(tree);
	return renderToString(
		<NavPathProvider initialPath={initialPath} initialSearch={initialSearch}>
			{tree}
		</NavPathProvider>,
	);
}

describe("useSearch（TanStack 兼容层）", () => {
	beforeEach(() => {
		// 地址栏停在一个「有自己 pattern 的路由」上：旧实现会把它当成
		// furin useSearch 的 from，从而和路由 store 的当前路由对不上。
		window.history.replaceState({}, "", "/games");
	});

	it("切页瞬间（地址栏已变、路由 store 未提交）不抛错", () => {
		expect(() => renderProbe()).not.toThrow();
	});

	it("读取根布局下发的 SSR search", () => {
		const html = renderProbe("/games", "?q=abc&sortBy=downloads");
		expect(html).toContain("abc");
		expect(html).toContain("downloads");
	});

	it("没有 search 时返回空对象", () => {
		expect(renderProbe("/", "")).toContain("{}");
	});
});
