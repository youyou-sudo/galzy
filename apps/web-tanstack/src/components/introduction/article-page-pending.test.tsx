import {
	articleHeroActions,
	articleHeroStore,
} from "@web/stores/articleHeroStore";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArticlePagePending } from "./article-page-pending";

// 只 mock 路由 Link：pending 组件本身不吃路由状态（articleId/gameId 由父级传入），
// 但页头的「返回列表」是真实 Button + Link，脱离 Router 渲染会抛错。
vi.mock("@tanstack/react-router", async () => {
	const { createElement } = await import("react");
	const href = (to: string, params?: Record<string, string>) =>
		params
			? Object.entries(params).reduce(
					(acc, [key, value]) => acc.replace("$" + key, value),
					to,
				)
			: to;
	return {
		Link: ({
			to,
			params,
			children,
		}: {
			to: string;
			params?: Record<string, string>;
			children?: ReactNode;
		}) => createElement("a", { href: href(to, params) }, children),
	};
});

const count = (markup: string, needle: string) =>
	markup.split(needle).length - 1;

const renderPending = (articleId = "52", gameId = "v1194") =>
	renderToString(<ArticlePagePending articleId={articleId} gameId={gameId} />);

beforeEach(() => {
	articleHeroStore.setState(() => ({ id: null, data: null }));
});

describe("ArticlePagePending", () => {
	it("入口带标题时：页头复用真实标题并挂同名 VT，不出标题骨架", () => {
		articleHeroActions.fromArticle({ id: 52, title: "开局三条线" });
		const markup = renderPending();

		expect(markup).toContain("开局三条线");
		// 与列表条目 / ArticlePage 同名同 class：路由切换时标题继续飞入页头，
		// styles.css 的 .article-title 规则才会命中（旧快照隐藏、同文本原位替换）
		expect(markup).toContain(
			'style="view-transition-name:article-title-52;view-transition-class:article-title"',
		);
		// 标题是真实文案，不该再有标题骨架
		expect(markup).not.toContain("w-48 h-8");
	});

	it("没有入口标题时：标题只出一处骨架，不伪造文案也不挂 VT", () => {
		const markup = renderPending();

		expect(markup).toContain("w-48 h-8");
		// 旧页文字不该飞进一个骨架盒
		expect(markup).not.toContain("article-title-52");
	});

	it("store 里是别的文章时不复用旧标题", () => {
		articleHeroActions.fromArticle({ id: 53, title: "别的文章" });
		const markup = renderPending("52");

		expect(markup).not.toContain("别的文章");
		expect(markup).toContain("w-48 h-8");
	});

	it("页头是真实外壳：「返回列表」是真实链接，静态「攻略」文案在位", () => {
		articleHeroActions.fromArticle({ id: 52, title: "开局三条线" });
		const markup = renderPending();

		expect(markup).toContain("<h1");
		expect(markup).toContain('href="/v1194/introduction"');
		expect(markup).toContain("返回列表");
		expect(markup).toContain("攻略");
		// 管理员操作依赖 session，pending 不渲染（避免非管理员看到假按钮）
		expect(markup).not.toContain("删除");
	});

	it("骨架标签层级合法：h1/p 里只有 span，正文才是 div", () => {
		articleHeroActions.fromArticle({ id: 52, title: "开局三条线" });
		const withTitle = renderPending();

		// 作者 + 日期两个骨架在 PageHeader 的 <p> 里，必须是 span：
		// 塞 div 会触发 React「<div> cannot be a descendant of <p>」hydration 报错
		const descStart = withTitle.indexOf('<p class="max-w-2xl');
		expect(descStart).toBeGreaterThan(-1);
		const desc = withTitle.slice(
			descStart,
			withTitle.indexOf("</p>", descStart),
		);
		expect(desc).not.toContain("<div");
		expect(count(desc, '<span data-slot="skeleton"')).toBe(2);
		// 正文骨架在 div 里，保持 9 行
		expect(count(withTitle, '<div data-slot="skeleton"')).toBe(9);

		// 无标题时骨架落在 <h1> 里：span + block（h1 只允许 phrasing content）
		const withoutTitle = renderPending("99");
		const h1Start = withoutTitle.indexOf("<h1");
		const titleRegion = withoutTitle.slice(
			h1Start,
			withoutTitle.indexOf("</h1>", h1Start),
		);
		expect(titleRegion).not.toContain("<div");
		expect(titleRegion).toContain('<span data-slot="skeleton"');
		expect(titleRegion).toContain("block w-48 h-8");
		expect(count(withoutTitle, '<span data-slot="skeleton"')).toBe(3);
	});

	it("只有作者/日期与正文出加载态，且数量确定", () => {
		articleHeroActions.fromArticle({ id: 52, title: "开局三条线" });
		const markup = renderPending();

		// 作者 1 + 日期 1 + 正文 9（4 + 3 + 2 行）
		expect(count(markup, 'data-slot="skeleton"')).toBe(11);
		for (const width of ["w-full", "w-11/12", "w-3/5", "w-[94%]"]) {
			expect(markup).toContain(width);
		}
		// 正文骨架整块 aria-hidden：读屏不会念一排灰条
		expect(markup).toContain('aria-hidden="true"');
	});
});

describe("articleHeroActions", () => {
	it("数字 id 归一成字符串，标题做 trim", () => {
		articleHeroActions.fromArticle({ id: 52, title: "  开局三条线  " });
		expect(articleHeroStore.state).toEqual({
			id: "52",
			data: { id: "52", title: "开局三条线" },
		});
	});

	it("id 为空时忽略，不污染别的文章", () => {
		articleHeroActions.fromArticle({ id: "  ", title: "x" });
		expect(articleHeroStore.state).toEqual({ id: null, data: null });
	});

	it("标题缺失时回写空串，由 pending 退回标题骨架", () => {
		articleHeroActions.fromArticle({ id: "52" });
		expect(articleHeroStore.state).toEqual({
			id: "52",
			data: { id: "52", title: "" },
		});
	});
});
