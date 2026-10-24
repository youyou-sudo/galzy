import { gameHeroStore } from "@web/stores/gameHeroStore";
import { r18Store } from "@web/stores/r18Store";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	GameDetailPending,
	PendingGameHero,
	PendingGameInfo,
} from "./game-detail-pending";

// 路由状态用可变对象驱动：mock 的 Link / useRouterState 每次渲染时读取当前值，
// 测试里改 routerMock.pathname 即可切到不同页签，不必起真实 router。
const routerMock = vi.hoisted(() => ({ pathname: "/v17" }));

vi.mock("@tanstack/react-router", async () => {
	const { createElement } = await import("react");
	const state = () => ({
		location: { pathname: routerMock.pathname },
		matches: [] as unknown[],
	});
	return {
		Link: ({
			to,
			params,
			children,
		}: {
			to: string;
			params?: { id?: string };
			children?: ReactNode;
		}) =>
			createElement(
				"a",
				{ href: params?.id ? to.replace("$id", params.id) : to },
				children,
			),
		useRouterState: (options?: {
			select?: (s: ReturnType<typeof state>) => unknown;
		}) => (options?.select ? options.select(state()) : state()),
		useRouter: () => ({ preloadRoute: () => Promise.resolve() }),
	};
});

const hero = {
	id: "v17",
	title: "テスト",
	olangTitle: "テスト",
	imageUrl: "https://example.com/cover.webp",
	thumbhash: null,
	width: 200,
	height: 300,
	cSexualAvg: 0,
};

beforeEach(() => {
	routerMock.pathname = "/v17";
	gameHeroStore.setState(() => ({ id: null, data: null }));
});

describe("PendingGameHero", () => {
	it("有列表数据时直接复用真实封面与标题，并带 VT 名称", () => {
		const markup = renderToString(<PendingGameHero hero={hero} id="v17" />);
		expect(markup).toContain("cover.webp");
		expect(markup).toContain("テスト");
		expect(markup).toContain("game-cover-v17");
		expect(markup).toContain("game-title-v17");
	});

	it("无列表数据时只出比例占位骨架，不伪造标题", () => {
		const markup = renderToString(<PendingGameHero hero={null} id="v17" />);
		expect(markup).not.toContain("cover.webp");
		expect(markup).not.toContain("未知作品");
		expect(markup).toContain('data-slot="skeleton"');
		// 旧实现封面塌陷的根因是父容器没有高度：这里由 w-55 提供宽度、
		// AspectRatio（data-slot + --ratio）按 9/12 反推高度，Skeleton 才铺得开
		expect(markup).toContain("w-55");
		expect(markup).toContain('data-slot="aspect-ratio"');
		expect(markup).toContain("--ratio:0.75");
	});

	it("横向封面用 min-w-72.5，与 GameHeader 的尺寸判定一致", () => {
		const markup = renderToString(
			<PendingGameHero hero={{ ...hero, width: 300, height: 200 }} id="v17" />,
		);
		expect(markup).toContain("min-w-72.5");
	});

	it("敏感封面在 pending 态也保持遮挡，不泄漏", () => {
		const previous = r18Store.state.showR18;
		r18Store.setState(() => ({ showR18: false }));
		try {
			const markup = renderToString(
				<PendingGameHero hero={{ ...hero, cSexualAvg: 2 }} id="v17" />,
			);
			expect(markup).toContain("涩！");
			expect(markup).toContain("显示");
			// 未揭示时不能渲染灯箱触发器（否则键盘/读屏可绕过遮挡）
			expect(markup).not.toContain("查看《");
		} finally {
			r18Store.setState(() => ({ showR18: previous }));
		}
	});
});

describe("PendingGameInfo", () => {
	it("只给发布/开发/发行/简介/TAG 出骨架", () => {
		const markup = renderToString(<PendingGameInfo />);
		for (const label of ["发布：", "开发：", "发行：", "游戏简介"]) {
			expect(markup).toContain(label);
		}
		// 3 个行内值 + 3 行简介 + 8 个 TAG 胶囊
		expect(markup.match(/data-slot="skeleton"/g)).toHaveLength(14);
		expect(markup.match(/rounded-full/g)).toHaveLength(8);
	});
});

describe("GameDetailPending", () => {
	it("渲染真实页面外壳：面包屑链接、卡片与页签", () => {
		gameHeroStore.setState(() => ({ id: "v17", data: hero }));
		const markup = renderToString(<GameDetailPending id="v17" />);

		expect(markup).toContain('aria-label="breadcrumb"');
		expect(markup).toContain('href="/"');
		expect(markup).toContain('href="/games"');
		expect(markup).toContain('href="/v17"');
		expect(markup).toContain("首页");
		expect(markup).toContain("全部游戏");
		expect(markup).toContain('data-slot="card"');
		expect(markup).toContain('data-slot="card-content"');
		for (const tab of ["下载", "攻略", "讨论", "统计", "系列"]) {
			expect(markup).toContain(tab);
		}
		// 页签是真实的导航链接（不是骨架），pending 期间即可直接切 tab
		for (const href of [
			'href="/v17"',
			'href="/v17/introduction"',
			'href="/v17/comment"',
			'href="/v17/translate"',
			'href="/v17/relations"',
		]) {
			expect(markup).toContain(href);
		}
	});

	it("默认下载页签出文件列表骨架，且整块容器不再 aria-hidden", () => {
		const markup = renderToString(<GameDetailPending id="v17" />);
		expect(markup).toContain("h-9 w-full rounded-lg");
		expect(markup).toContain("发布：");
		expect(markup).toContain("游戏简介");
		// @unpic 的预加载 <link> 可能在最前；根 div 自身不带 aria-hidden，
		// 面包屑/页签才是真实可交互内容（骨架各自 aria-hidden）
		expect(markup).toContain('<div><nav aria-label="breadcrumb"');
	});

	it("其它页签改用通用 tab 骨架", () => {
		routerMock.pathname = "/v17/comment";
		const markup = renderToString(<GameDetailPending id="v17" />);
		expect(markup).toContain("h-24 w-full rounded-xl");
		expect(markup).not.toContain("h-9 w-full rounded-lg");
	});

	it("攻略文章嵌套路径仍按攻略页签出通用骨架", () => {
		routerMock.pathname = "/v17/introduction/42";
		const markup = renderToString(<GameDetailPending id="v17" />);
		expect(markup).toContain("h-24 w-full rounded-xl");
		expect(markup).not.toContain("h-9 w-full rounded-lg");
	});

	it("store 里的 hero 与路由 id 不一致时不复用旧条目数据", () => {
		gameHeroStore.setState(() => ({ id: "v18", data: { ...hero, id: "v18" } }));
		const markup = renderToString(<GameDetailPending id="v17" />);
		expect(markup).not.toContain("cover.webp");
		expect(markup).toContain('data-slot="aspect-ratio"');
	});
});
