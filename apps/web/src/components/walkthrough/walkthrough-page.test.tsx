// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeChart } from "./chart/chart-fixtures";
import { WalkthroughPage } from "./walkthrough-page";

// vitest 配了 globals:false，Testing Library 不会自动清理；不手动清就会跨用例累积 DOM
afterEach(cleanup);

/** 与列表页同一套 nav mock：单测不需要真实路由上下文 */
const routerMock = vi.hoisted(() => ({ pathname: "/v15/walkthrough/2804" }));

vi.mock("@web/lib/nav", async () => {
	const { createElement } = await import("react");
	type Params = Record<string, string> | undefined;
	return {
		Link: ({
			to,
			params,
			children,
		}: {
			to: string;
			params?: Params;
			children?: unknown;
		}) => {
			let href = to;
			for (const [key, value] of Object.entries(params ?? {})) {
				href = href.replace(`:${key}`, value);
			}
			return createElement("a", { href }, children as never);
		},
		usePathname: () => routerMock.pathname,
	};
});

beforeEach(() => {
	routerMock.pathname = "/v15/walkthrough/2804";
});

/**
 * 最小可用详情 DTO：摘要字段是 camelCase（后端 service 的约定），
 * chart 内层保持上游 snake_case。
 */
const detailData = {
	id: "2804",
	workId: "15",
	lang: "ja",
	source: "seiya",
	sourceUrl: "https://saiga.example/wt.html",
	sourceAuthor: null,
	sourceUpdatedOn: "2020-02-15",
	workContentLimit: "sfw",
	workRouteHints: false,
	release: {
		id: "1",
		title: "千恋＊万花",
		lang: "ja",
		releaseKind: "default",
		companies: ["ゆずソフト"],
	},
	characters: [
		{
			key: "c1",
			name: "朝武芳乃",
			characterId: null,
			displayName: "朝武芳乃",
			localized: {},
		},
	],
	endingCount: 13,
	saveCount: 7,
	segmentCount: 1,
	upstreamUpdatedAt: "2026-11-01T10:00:00.000Z",
	chart: {
		sections: [
			{ key: "s1", title: "芳乃线", localized: {}, character_keys: ["c1"] },
		],
		legend: [
			{
				text: "★の選択肢は差分CG回収用",
				localized: {
					"zh-Hans": { value: "★ 的选项用于回收差分 CG", is_machine: true },
				},
			},
		],
		entries: [{ key: "e1", label: "START", localized: {} }],
		saves: [{ key: "sv1", label: "◆存档01", localized: {} }],
		endings: [
			{
				key: "ed1",
				name: "芳乃END",
				localized: {},
				ending_type: "heroine",
				character_keys: ["c1"],
			},
		],
		segments: [
			{
				key: "seg1",
				section_key: "s1",
				from_node: { key: "e1", node_type: "entry" },
				to_node: { key: "ed1", node_type: "ending" },
				condition: null,
				condition_localized: {},
				requires_ending_keys: [],
				steps: [
					{
						step_type: "choice",
						text: "正直に言う",
						localized: {
							"zh-Hans": { value: "老实说", is_machine: true },
						},
						alternatives: [],
						remark: null,
						remark_localized: {},
						achievement: false,
						save_key: null,
					},
				],
			},
		],
	},
};

/**
 * 双角色 + 完整 chart 的详情：验证「切角色不动视图」。
 * chart 用共享夹具（芳乃线 + 茉子线），比内联 detailData 的一条段覆盖更全。
 */
const multiCharacterData = {
	...detailData,
	characters: [
		{
			key: "c1",
			name: "朝武芳乃",
			characterId: null,
			displayName: "朝武芳乃",
			localized: {},
		},
		{
			key: "c2",
			name: "常陸茉子",
			characterId: null,
			displayName: "常陸茉子",
			localized: {},
		},
	],
	chart: makeChart(),
};

describe("WalkthroughPage", () => {
	it("概览卡：三个计数与来源署名（会社/发售日/两个出口已移除）", () => {
		const html = renderToString(<WalkthroughPage data={detailData} />);
		expect(html).toContain("13 个结局");
		expect(html).toContain("7 个存档点");
		expect(html).toContain("1 名角色");
		// source_author 为空 → 退到外链域名，不伪造中文站名
		expect(html).toContain("saiga.example");
		expect(html).toContain("只保留了选项与存档结构，原文说明请查看原页面。");
		expect(html).toContain("没有可靠译名的人名保持原文");
		// 概览块不再给会社 / 发售日 / 返回游戏页
		expect(html).not.toContain("制作会社");
		expect(html).not.toContain("发售日期");
		expect(html).not.toContain("返回游戏页面");
		// 但要有「查看原攻略页面」出口，且新窗口打开
		expect(html).toContain("查看原攻略页面");
		expect(html).toContain("https://saiga.example/wt.html");
		expect(html).toContain('target="_blank"');
		expect(html).toContain("noopener");
	});

	// 用户要求：概览不用卡片包裹，直接落在页面上
	it("概览块不被 Card 包裹", () => {
		const html = renderToString(<WalkthroughPage data={detailData} />);
		expect(html).not.toContain('data-slot="card"');
	});

	// 本站整理的攻略没有原页面（sourceUrl 为空）→ 不给出口
	it("没有原页面时不渲染「查看原攻略页面」", () => {
		const html = renderToString(
			<WalkthroughPage data={{ ...detailData, sourceUrl: null }} />,
		);
		expect(html).not.toContain("查看原攻略页面");
	});

	// 用户要求：出口是文字链接，不是按钮（别用 buttonVariants 那套底/边框）
	it("「查看原攻略页面」是文字链接", () => {
		render(<WalkthroughPage data={multiCharacterData} />);
		const link = screen.getByRole("link", { name: /查看原攻略页面/ });
		expect(link.getAttribute("target")).toBe("_blank");
		expect(link.className).toContain("text-primary");
		// 用户要求：默认 70% 透明，hover / 聚焦时回到 100%
		expect(link.className).toContain("opacity-70");
		expect(link.className).toContain("hover:opacity-100");
		expect(link.className).not.toContain("bg-background");
		expect(link.className).not.toContain("border-border");
	});

	it("角色路线卡：结局数/段数取自 chartStats", () => {
		const html = renderToString(<WalkthroughPage data={detailData} />);
		// 不再有「角色路线」大标题，只剩提示小字
		expect(html).not.toContain("角色路线</h2>");
		expect(html).toContain("选择角色查看这条路线的选项");
		expect(html).toContain("朝武芳乃");
		expect(html).toContain("1 个结局 · 1 段");
		expect(html).toContain("全部路线");
	});

	it("角色路线卡：名册头像 + 身份徽章 + 选中态", () => {
		const withCharacterId = {
			...detailData,
			characters: [{ ...detailData.characters[0], characterId: "39099" }],
		};
		const roster = {
			characters: [
				{
					id: "39099",
					name: "朝武芳乃",
					rosterRole: "main",
					imageUrl: "https://img.example/yoshino.webp",
				},
			],
		};
		const html = renderToString(
			<WalkthroughPage data={withCharacterId} roster={roster} />,
		);
		// 头像走名册（按 chart 角色钉住的 kungal 角色 id 匹配）
		expect(html).toContain("img.example/yoshino.webp");
		// 身份徽章与选中勾
		expect(html).toContain("主角");
		// 「全部路线」卡仍在最前，且没有头像时用占位
		expect(html).toContain("全部路线");
		expect(html).toContain("1 个结局 · 1 段");
	});

	it("默认视图与切换按钮：按角色 / 按顺序 / 流程图 + 语言下拉", () => {
		const html = renderToString(<WalkthroughPage data={detailData} />);
		for (const label of ["按角色", "按顺序", "流程图"]) {
			expect(html).toContain(label);
		}
		// 语言改成 Select：SSR 只直出当前档（默认中文），三档在弹层里
		expect(html).toContain("语言切换");
		expect(html).toContain(">中文<");
		// 默认 character 视图：段落概览 + 正文段落锚点
		// （React 会在文本节点间插注释，分段断言而不是整串匹配）
		expect(html).toContain("本路线分");
		expect(html).toContain("点击跳到对应段落");
		expect(html).toContain("wt-seg-seg1");
		// 符号说明默认折叠（details 无 open 属性）
		expect(html).toContain("符号说明");
		expect(html).not.toContain("<details open");
	});

	// 语言三档收进 Select：点开才列出「中文 / 原文 / 双语」，选中后触发器回显
	it("语言切换是 Select：展开列出三档，选后回显", async () => {
		render(<WalkthroughPage data={multiCharacterData} />);
		const trigger = () => screen.getByRole("combobox", { name: "语言切换" });
		expect(trigger().textContent).toContain("中文");

		fireEvent.click(trigger());
		const list = await screen.findByRole("listbox");
		for (const label of ["中文", "原文", "双语"]) {
			expect(within(list).getByText(label)).toBeDefined();
		}
		// Base UI 的 select 只认「在选项上按下过指针」之后的鼠标点击（防误选中），
		// jsdom 没有真实指针：在 option 上补 pointerDown，再派发 detail=1 的点击
		const option = within(list).getByRole("option", { name: "原文" });
		fireEvent.pointerDown(option);
		fireEvent.click(option, { detail: 1 });
		await waitFor(() => expect(trigger().textContent).toContain("原文"));
	});

	// 角色选择排在视图选项卡之后：先选看哪张视图，再用角色卡过滤这张视图。
	// 参考站是「角色区 → 视图切换」，这里换过顺序，别让重构又翻回去。
	it("角色路线卡在视图选项卡下面", () => {
		const html = renderToString(<WalkthroughPage data={detailData} />);
		const toolbar = html.indexOf("按角色");
		const routes = html.indexOf("选择角色查看这条路线的选项");
		const content = html.indexOf("本路线分");
		expect(toolbar).toBeGreaterThanOrEqual(0);
		expect(routes).toBeGreaterThan(toolbar);
		expect(content).toBeGreaterThan(routes);
	});

	// 「按顺序」列的是整份攻略的阅读顺序，本来就不按角色过滤：
	// 摆一排点了没反应的路线卡只会误导，所以干脆不渲染。
	it("按顺序视图不渲染角色路线卡", () => {
		render(<WalkthroughPage data={multiCharacterData} initialView="order" />);
		expect(screen.queryByText("选择角色查看这条路线的选项")).toBeNull();
		expect(screen.queryByText("全部路线")).toBeNull();
		expect(
			screen
				.getByRole("button", { name: "按顺序" })
				.getAttribute("aria-pressed"),
		).toBe("true");
	});

	// 流程图是**内联**视图；「全屏」只是画布操作按钮里的一个选项
	it("流程图内联渲染，不自动打开 Modal", () => {
		render(<WalkthroughPage data={multiCharacterData} initialView="graph" />);
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(
			screen
				.getByRole("button", { name: "流程图" })
				.getAttribute("aria-pressed"),
		).toBe("true");
		// 画布 + 桌面右侧选项栏都在页面里
		expect(document.querySelector("[data-graph-canvas]")).not.toBeNull();
		expect(document.querySelectorAll("[data-graph-options-aside]").length).toBe(
			1,
		);
	});

	it("画布操作按钮里的「全屏」打开 Modal，退出全屏关闭它", async () => {
		render(<WalkthroughPage data={multiCharacterData} initialView="graph" />);
		fireEvent.click(screen.getByRole("button", { name: "全屏" }));
		const dialog = screen.getByRole("dialog");
		expect(within(dialog).getByText("选项流程图")).toBeDefined();
		fireEvent.click(within(dialog).getByRole("button", { name: "退出全屏" }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		// 关掉全屏后仍停在页内的流程图视图
		expect(
			screen
				.getByRole("button", { name: "流程图" })
				.getAttribute("aria-pressed"),
		).toBe("true");
	});

	// 面板底部的出口：切到「按顺序」（锚点只存在于顺序视图）
	it("流程图里「在路线列表中查看」切到按顺序", async () => {
		render(<WalkthroughPage data={multiCharacterData} initialView="graph" />);
		// 桌面右侧栏与窄屏下方面板都在 DOM 里（CSS 只显示其一），点第一个即可
		fireEvent.click(
			screen.getAllByRole("button", { name: "在路线列表中查看" })[0],
		);
		await waitFor(() =>
			expect(
				screen
					.getByRole("button", { name: "按顺序" })
					.getAttribute("aria-pressed"),
			).toBe("true"),
		);
	});

	it("chart 缺失时给空态而不是崩掉", () => {
		const html = renderToString(
			<WalkthroughPage data={{ ...detailData, chart: null }} />,
		);
		expect(html).toContain("暂无流程数据");
	});

	it("数据整体缺失时给「攻略不存在」", () => {
		const html = renderToString(<WalkthroughPage data={null} />);
		expect(html).toContain("攻略不存在");
	});

	// 角色只是过滤条件，与视图正交：在流程图里点角色卡只换图，
	// 不能把视图弹回默认的「按角色」
	it("流程图里点角色卡，视图 tab 保持选中", () => {
		render(<WalkthroughPage data={multiCharacterData} initialView="graph" />);
		const routes = screen
			.getByText("选择角色查看这条路线的选项")
			.closest("section");
		expect(routes).not.toBeNull();
		const target = within(routes as HTMLElement).getByRole("button", {
			name: /常陸茉子/,
		});
		fireEvent.click(target);

		expect(target.getAttribute("aria-pressed")).toBe("true");
		expect(
			screen
				.getByRole("button", { name: "按角色" })
				.getAttribute("aria-pressed"),
		).toBe("false");
		expect(
			screen
				.getByRole("button", { name: "流程图" })
				.getAttribute("aria-pressed"),
		).toBe("true");
	});
});
