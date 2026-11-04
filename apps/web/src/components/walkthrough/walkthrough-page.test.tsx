import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WalkthroughPage } from "./walkthrough-page";

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

describe("WalkthroughPage", () => {
	it("概览卡：会社、发售日期、三个计数、来源署名与两个出口", () => {
		const html = renderToString(
			<WalkthroughPage
				companies={["ゆずソフト", "NekoNyan"]}
				data={detailData}
				gameId="v15"
				releasedAt="2016-07-29"
			/>,
		);
		// 制作会社来自作品的厂商（不是 release.companies：那是发行版/汉化组）
		expect(html).toContain("ゆずソフト");
		expect(html).toContain("NekoNyan");
		expect(html).toContain("2016-07-29");
		expect(html).toContain("13 个结局");
		expect(html).toContain("7 个存档点");
		expect(html).toContain("1 名角色");
		// source_author 为空 → 退到外链域名，不伪造中文站名
		expect(html).toContain("saiga.example");
		expect(html).toContain("只保留了选项与存档结构，原文说明请查看原页面。");
		expect(html).toContain("没有可靠译名的人名保持原文");
		expect(html).toContain('href="/v15"');
		expect(html).toContain("查看原攻略页面");
	});

	it("角色路线卡：结局数/段数取自 chartStats", () => {
		const html = renderToString(
			<WalkthroughPage data={detailData} gameId="v15" />,
		);
		expect(html).toContain("角色路线");
		expect(html).toContain("选择角色查看这条路线的选项");
		expect(html).toContain("朝武芳乃");
		expect(html).toContain("1 个结局 · 1 段");
		expect(html).toContain("全部路线");
	});

	it("默认视图与切换按钮：按角色 / 按顺序 / 流程图 + 三档语言", () => {
		const html = renderToString(
			<WalkthroughPage data={detailData} gameId="v15" />,
		);
		for (const label of ["按角色", "按顺序", "流程图"]) {
			expect(html).toContain(label);
		}
		for (const label of ["双语", "原文", "中文"]) {
			expect(html).toContain(label);
		}
		// 默认 character 视图：段落概览 + 正文段落锚点
		// （React 会在文本节点间插注释，分段断言而不是整串匹配）
		expect(html).toContain("本路线分");
		expect(html).toContain("点击跳到对应段落");
		expect(html).toContain("wt-seg-seg1");
		// 符号说明默认折叠（details 无 open 属性）
		expect(html).toContain("符号说明");
		expect(html).not.toContain("<details open");
	});

	it("chart 缺失时给空态而不是崩掉", () => {
		const html = renderToString(
			<WalkthroughPage data={{ ...detailData, chart: null }} gameId="v15" />,
		);
		expect(html).toContain("暂无流程数据");
	});

	it("数据整体缺失时给「攻略不存在」", () => {
		const html = renderToString(<WalkthroughPage data={null} gameId="v15" />);
		expect(html).toContain("攻略不存在");
	});
});
