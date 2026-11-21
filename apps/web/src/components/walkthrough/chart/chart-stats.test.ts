import { describe, expect, it } from "vitest";
import {
	makeChart,
	makeEmptyChart,
	makeSharedSectionChart,
} from "./chart-fixtures";
import {
	COMMON_CHARACTER_KEY,
	chartNodeId,
	chartStats,
	endingTypeBadgeLabel,
	nodeStartPhrase,
	resolveText,
	segmentAnchorId,
	segmentCharacterKeys,
	segmentOptionCount,
	segmentsForCharacter,
	stepNumbers,
	zhText,
} from "./chart-utils";

describe("chartStats", () => {
	it("全量计数与每角色计数", () => {
		const stats = chartStats(makeChart());
		expect(stats.segments).toBe(5);
		expect(stats.endings).toBe(4);
		expect(stats.saves).toBe(2);
		expect(stats.entries).toBe(2);
		expect(stats.byCharacter.c1).toEqual({ endings: 2, segments: 3 });
		expect(stats.byCharacter.c2).toEqual({ endings: 2, segments: 2 });
		expect(stats.common).toEqual({ endings: 0, segments: 0 });
	});

	it("空图全零，不抛错", () => {
		expect(chartStats(makeEmptyChart())).toEqual({
			endings: 0,
			segments: 0,
			saves: 0,
			entries: 0,
			byCharacter: {},
			common: { endings: 0, segments: 0 },
		});
	});
});

// v50215（アマカノ３）实测：上游的分组把同段出场的 3 个女角全写进
// section.character_keys，按分组归属会把三条线算成「每人 3 段」
describe("段落归属", () => {
	it("终点是结局时按结局的角色算，分组挂几个角色都不影响", () => {
		const chart = makeSharedSectionChart();
		expect(segmentCharacterKeys(chart, chart.segments[0])).toEqual(["c1"]);
		expect(segmentCharacterKeys(chart, chart.segments[1])).toEqual(["c2"]);
	});

	it("终点不是结局才退回分组（共享回收段），分组没挂角色是共通", () => {
		const chart = makeSharedSectionChart();
		expect(segmentCharacterKeys(chart, chart.segments[2])).toEqual([
			"c1",
			"c2",
			"c3",
		]);
		expect(segmentCharacterKeys(chart, chart.segments[3])).toEqual([]);
	});

	it("角色卡计数与段落过滤同一口径，共通单独归一组", () => {
		const chart = makeSharedSectionChart();
		const stats = chartStats(chart);
		expect(stats.byCharacter.c1).toEqual({ endings: 1, segments: 2 });
		expect(stats.byCharacter.c2).toEqual({ endings: 1, segments: 2 });
		expect(stats.byCharacter.c3).toEqual({ endings: 0, segments: 1 });
		expect(stats.common).toEqual({ endings: 1, segments: 1 });

		expect(segmentsForCharacter(chart, "c1").map((s) => s.key)).toEqual([
			"g1",
			"g3",
		]);
		expect(segmentsForCharacter(chart, "c2").map((s) => s.key)).toEqual([
			"g2",
			"g3",
		]);
		// 共通段不混进角色线：卡片数字就是列表长度
		expect(
			segmentsForCharacter(chart, COMMON_CHARACTER_KEY).map((s) => s.key),
		).toEqual(["g4"]);
	});
});

describe("双语解析", () => {
	const zh = { "zh-Hans": { value: "老实说", is_machine: true } };

	it("both：中文主文 + 括注原文", () => {
		expect(resolveText("正直に言う", zh, "both")).toEqual({
			primary: "老实说",
			secondary: "正直に言う",
		});
	});

	it("缺中文时 both 只出原文，不出空括注", () => {
		expect(resolveText("芳乃END", {}, "both")).toEqual({
			primary: "芳乃END",
			secondary: null,
		});
	});

	it("source / zh 各取一侧", () => {
		expect(resolveText("正直に言う", zh, "source")).toEqual({
			primary: "正直に言う",
			secondary: null,
		});
		expect(resolveText("正直に言う", zh, "zh")).toEqual({
			primary: "老实说",
			secondary: null,
		});
	});

	it("只有一侧时另一侧也不空", () => {
		expect(resolveText(null, zh, "both")).toEqual({
			primary: "老实说",
			secondary: null,
		});
		expect(resolveText("正直に言う", {}, "zh")).toEqual({
			primary: "正直に言う",
			secondary: null,
		});
	});

	it("中文 key 兼容 zh-Hans / zh / zh-CN", () => {
		expect(zhText({ "zh-CN": { value: "存档12", is_machine: true } })).toBe(
			"存档12",
		);
		expect(zhText({ ja: { value: "セーブ12", is_machine: false } })).toBeNull();
		expect(zhText({})).toBeNull();
	});
});

describe("段落工具", () => {
	it("按角色过滤：只留归属该角色的段落", () => {
		const chart = makeChart();
		expect(segmentsForCharacter(chart, null).length).toBe(5);
		expect(segmentsForCharacter(chart, "c1").map((s) => s.key)).toEqual([
			"seg1",
			"seg2",
			"seg3",
		]);
		expect(segmentsForCharacter(chart, "c2").map((s) => s.key)).toEqual([
			"seg4",
			"seg5",
		]);
	});

	it("选项数只算 choice/action，不含存档/小标题/备注", () => {
		const chart = makeChart();
		// seg1 里 3 个 choice + 1 个 action；heading / save / note 不占号
		expect(segmentOptionCount(chart.segments[0])).toBe(4);
	});

	it("编号跳过 heading/save/note，并在 heading 处归零", () => {
		// 实测：g1 先 1-8，遇到「■芳乃线」后重新 1-8
		expect(stepNumbers(makeChart().segments[0].steps)).toEqual([
			null,
			1,
			2,
			null,
			3,
			null,
			null,
			1,
		]);
	});

	it("未知 step_type 只显示文本、不编号", () => {
		const chart = makeChart();
		const segmentSteps = chart.segments[0].steps;
		expect(
			stepNumbers([
				...segmentSteps,
				{ ...segmentSteps[1], step_type: "minigame" as never },
			]).at(-1),
		).toBeNull();
	});

	it("起点短语按 from_node 三态", () => {
		const chart = makeChart();
		const [seg1, seg2, seg3] = chart.segments;
		expect(nodeStartPhrase(chart, seg1.from_node, "both")).toEqual({
			primary: "从【START】开始",
			secondary: null,
		});
		expect(nodeStartPhrase(chart, seg2.from_node, "both")).toEqual({
			primary: "接在「芳乃END」之后",
			secondary: null,
		});
		// 存档 label 本身有中文译文，所以双语时括注原文也带着短语
		expect(nodeStartPhrase(chart, seg3.from_node, "both")).toEqual({
			primary: "读取「◆存档05」",
			secondary: "读取「◆セーブ05」",
		});
	});

	it("结局徽章只给实测过的三种", () => {
		expect(endingTypeBadgeLabel("heroine")).toBe("个人线");
		expect(endingTypeBadgeLabel("after")).toBe("后日谈");
		expect(endingTypeBadgeLabel("bad")).toBe("坏结局");
		expect(endingTypeBadgeLabel("true")).toBeNull();
		expect(endingTypeBadgeLabel("harem")).toBeNull();
	});

	it("锚点 id 与节点 id 稳定", () => {
		expect(segmentAnchorId("seg1")).toBe("wt-seg-seg1");
		expect(chartNodeId({ node_type: "ending", key: "e1" })).toBe("ending:e1");
		// collect/open 的 key 为 null，这是契约的一部分
		expect(chartNodeId({ node_type: "collect", key: null })).toBe("collect:");
	});
});
