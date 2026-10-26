import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HomePagePending } from "./home-page-pending";

// pending 态本身就渲染在 router 上下文内（真实应用里 Link/useNavigate/useSearch
// 都可用），测试只 mock 掉路由以便 SSR 渲染：Link 变成可断言的 <a>，$param 用
// params 替换；Search 里的导航/search 取值不会在 pending 态被触发，置空即可。
vi.mock("@tanstack/react-router", async () => {
	const { createElement } = await import("react");
	// 把 to/$param/search 还原成真实 href：这样断言能覆盖「更多 →」的查询串，
	// 而不只是基础路径（真实应用里它们分别是 ?sort=hotWeek&order=desc 等）。
	const href = (
		to: string,
		params?: Record<string, string>,
		search?: Record<string, unknown>,
	) => {
		const url = params
			? Object.entries(params).reduce(
					(acc, [key, value]) => acc.replace("$" + key, value),
					to,
				)
			: to;
		if (!search) return url;
		const query = new URLSearchParams();
		for (const [key, value] of Object.entries(search)) {
			if (value === undefined || value === null) continue;
			query.set(key, String(value));
		}
		const qs = query.toString();
		return qs ? url + "?" + qs : url;
	};
	return {
		Link: ({
			to,
			params,
			search,
			children,
		}: {
			to: string;
			params?: Record<string, string>;
			search?: Record<string, unknown>;
			children?: ReactNode;
		}) => createElement("a", { href: href(to, params, search) }, children),
		useNavigate: () => () => {},
		useSearch: () => ({}),
	};
});

const TOTAL_COUNT = 12345;

// 预置 ["totalCount"]：Count 是 useSuspenseQuery，命中 cache 就同步拿到数字，
// 不会走 CountComponent 内部的数字骨架——这样「共收录了：12345条目」能整句断言。
function renderPending() {
	const queryClient = new QueryClient();
	queryClient.setQueryData(["totalCount"], TOTAL_COUNT);
	return renderToString(
		<QueryClientProvider client={queryClient}>
			<HomePagePending />
		</QueryClientProvider>,
	);
}

const count = (markup: string, needle: string) =>
	markup.split(needle).length - 1;

/** 按区块标题切段：数各区块的骨架数量时不会串到别的区块。 */
function sectionOf(markup: string, from: string, to?: string) {
	const start = markup.indexOf(from);
	const end = to ? markup.indexOf(to, start + from.length) : -1;
	return markup.slice(start, end === -1 ? undefined : end);
}

describe("HomePagePending", () => {
	it("标题、防失联 Badge、计数文案、搜索栏都是真实 HTML", () => {
		const markup = renderPending();

		// 首页大标题 + 防失联入口
		expect(markup).toContain("紫缘社");
		expect(markup).toContain("防失联地址：galzy.top");
		expect(markup).toContain('href="https://galzy.top/"');

		// 计数文案是固定 HTML，数字来自预置的 query 数据（不是骨架）
		const countRegion = sectionOf(markup, "共收录了：", "频道");
		expect(countRegion).toContain(String(TOTAL_COUNT));
		expect(countRegion).toContain("条目");
		expect(countRegion).not.toContain('data-slot="skeleton"');

		// 搜索栏真实渲染（真实 <input> + 搜索按钮），不是输入框骨架
		expect(markup).toContain("标题、标签、回车，喵喵喵～🐾");
		expect(markup).toContain("<input");
		expect(markup).toContain("搜索");
		const searchRegion = sectionOf(
			markup,
			"mx-auto mt-6 mb-8 w-full max-w-2xl",
			"热门标签",
		);
		expect(searchRegion).not.toContain('data-slot="skeleton"');
	});

	it("三个区块标题与「更多」链接各只出现一次，且都是真实链接", () => {
		const markup = renderPending();

		for (const title of ["热门标签", "本周热门", "精选合集"]) {
			expect(count(markup, title)).toBe(1);
		}
		for (const more of ["更多 →", "更多游戏 →", "更多合集 →"]) {
			expect(count(markup, more)).toBe(1);
		}
		// 三个「更多」都是可点的真实链接（含各自的查询串），pending 期间就能直接跳走
		expect(markup).toContain('href="/tags/category/hot?');
		expect(markup).toContain("sort=hotWeek");
		expect(markup).toContain('href="/games?');
		expect(markup).toContain("sortBy=downloads");
		expect(markup).toContain('href="/collections?');
		expect(markup).toContain("page=1");
	});

	it("只有区块内容是加载态：4 个标签药丸、24 张热游卡、6 个合集卡", () => {
		const markup = renderPending();

		// 标签药丸骨架（标题行是真实的，所以只数内容区）
		const tagsContent = sectionOf(markup, "热门标签", "本周热门");
		expect(count(tagsContent, 'data-slot="skeleton"')).toBe(4);
		// 同一个区块里标题行的「更多 →」仍是真实链接，说明骨架只替换了内容
		expect(tagsContent).toContain('href="/tags/category/hot?');
		expect(tagsContent).toContain("更多 →");

		// 热游卡片骨架：24 张 + 与真实栅格相同的断点隐藏（3×4 / 4×4 / 6×4）
		const gamesContent = sectionOf(markup, "本周热门", "精选合集");
		expect(count(gamesContent, "aspect-[9/13]")).toBe(24);
		expect(count(gamesContent, "hidden sm:block")).toBe(4);
		expect(count(gamesContent, "hidden md:block")).toBe(8);
		expect(gamesContent).toContain('href="/games?');
		expect(gamesContent).toContain("更多游戏 →");

		// 合集卡片骨架：6 个，栅格 2/3/6 列各一整行
		const collectionsContent = sectionOf(markup, "精选合集");
		expect(count(collectionsContent, "aspect-[4/5]")).toBe(6);
		expect(collectionsContent).toContain('href="/collections?');
		expect(collectionsContent).toContain("page=1");
		expect(collectionsContent).toContain("更多合集 →");
	});

	it("不再有整页骨架与假的标题骨架", () => {
		const markup = renderPending();

		// 旧的 HomePageSkeleton 外壳（整页 min-h-screen 包裹）已移除
		expect(markup).not.toContain("min-h-screen flex flex-col");
		// 旧骨架里的标题/副标题/计数/搜索框占位
		expect(markup).not.toContain("h-10 w-3/4 mx-auto");
		expect(markup).not.toContain("h-5 w-44 mx-auto");
		expect(markup).not.toContain("h-10 w-full rounded-lg");
		// 三个区块旧骨架里「图标 + 假标题」的占位条
		expect(markup).not.toContain("h-6 w-24 rounded bg-muted");
		expect(markup).not.toContain("size-5 rounded bg-muted");
		// 顶栏（Header）挂在 __root 外层、本来就固定（fixed 药丸）；pending 不能再渲染一份
		expect(markup).not.toContain("fixed inset-x-0 top-0 z-50");
	});
});
