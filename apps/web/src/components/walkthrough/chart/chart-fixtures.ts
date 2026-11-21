import type {
	ChartAlternative,
	ChartEnding,
	ChartEndingType,
	ChartLocalized,
	ChartNode,
	ChartSave,
	ChartSection,
	ChartSegment,
	ChartStep,
	ChartStepType,
	WalkthroughChart,
} from "./types";

/**
 * 测试夹具：按参考站千恋＊万花「芳乃线」的形状裁剪出来的小图。
 * 只给测试用，不进产物（生产代码不 import 这个文件）。
 */

/** 构造 BCP-47 译文：zh 传 null 表示没有中文译文 */
export function localized(zh: string | null): ChartLocalized {
	return zh ? { "zh-Hans": { value: zh, is_machine: true } } : {};
}

export function step(
	stepType: ChartStepType,
	text: string | null,
	zh: string | null,
	extra: Partial<ChartStep> = {},
): ChartStep {
	return {
		step_type: stepType,
		text,
		localized: localized(zh),
		alternatives: [],
		remark: null,
		remark_localized: {},
		achievement: false,
		save_key: null,
		...extra,
	};
}

export function alternative(text: string, zh: string | null): ChartAlternative {
	return { text, localized: localized(zh) };
}

export function node(
	nodeType: ChartNode["node_type"],
	key: string | null,
): ChartNode {
	return { node_type: nodeType, key };
}

export function ending(
	key: string,
	name: string,
	zh: string | null,
	endingType: ChartEndingType,
	characterKeys: string[],
): ChartEnding {
	return {
		key,
		name,
		localized: localized(zh),
		ending_type: endingType,
		character_keys: characterKeys,
	};
}

export function save(key: string, label: string, zh: string | null): ChartSave {
	return { key, label, localized: localized(zh) };
}

export function section(
	key: string,
	title: string,
	zh: string | null,
	characterKeys: string[],
): ChartSection {
	return {
		key,
		title,
		localized: localized(zh),
		character_keys: characterKeys,
	};
}

export function segment(
	key: string,
	sectionKey: string | null,
	from: ChartNode,
	to: ChartNode,
	steps: ChartStep[],
	extra: Partial<ChartSegment> = {},
): ChartSegment {
	return {
		key,
		section_key: sectionKey,
		from_node: from,
		to_node: to,
		condition: null,
		condition_localized: {},
		requires_ending_keys: [],
		steps,
		...extra,
	};
}

/** 一份小图：两条角色线 + 一个存档回收段 */
export function makeChart(): WalkthroughChart {
	return {
		sections: [
			{
				key: "s1",
				title: "■芳乃ルート",
				localized: localized("■芳乃线"),
				character_keys: ["c1"],
			},
			{
				key: "s2",
				title: "■茉子ルート",
				localized: localized("■茉子线"),
				character_keys: ["c2"],
			},
		],
		legend: [
			{
				text: "( )の選択肢は差分CG回収の為に両方回収してください。",
				localized: localized("( )的选项是为了回收差分 CG，请把两个都回收。"),
			},
		],
		entries: [
			{
				key: "en1",
				label: "START",
				localized: {},
				unlocked_by_ending_key: null,
			},
			{
				key: "en2",
				label: "RESTART",
				localized: localized("重开"),
				unlocked_by_ending_key: "e1",
			},
		],
		saves: [
			save("sv01", "◆セーブ01", "◆存档01"),
			save("sv05", "◆セーブ05", "◆存档05"),
		],
		endings: [
			ending("e1", "芳乃END", null, "heroine", ["c1"]),
			ending("e2", "芳乃アフターEND", "芳乃AFTEREND", "after", ["c1"]),
			ending("e3", "俺たちの戦いは以下略END", "我们的战斗以下略END", "bad", [
				"c2",
			]),
			ending("e4", "茉子END", null, "heroine", ["c2"]),
		],
		segments: [
			segment("seg1", "s1", node("entry", "en1"), node("ending", "e1"), [
				step("heading", "■芳乃ルート", "■芳乃线"),
				step("choice", "正直に言う", "老实说", {
					remark: "副+1",
					remark_localized: localized("副+1"),
					alternatives: [alternative("誤魔化す", "蒙混过去")],
				}),
				step("choice", "どうだろ?", "怎么样?", {
					remark: "茉子+1",
					remark_localized: localized("茉子+1"),
				}),
				step("save", null, null, { save_key: "sv01" }),
				step("action", "釣り", "钓鱼"),
				// 第二个 heading：编号在这里归零（参考站实测：1-8 → ■芳乃线 → 重新 1-8）
				step("heading", "■アフター", "■AFTER"),
				step("note", "Q.SAVEを使ってください", "请使用 Q.SAVE"),
				step("choice", "扉を開ける", "打开门", { achievement: true }),
			]),
			segment(
				"seg2",
				"s1",
				node("ending", "e1"),
				node("ending", "e2"),
				[step("note", "アフターストーリーに入る", "进入后日谈故事")],
				{
					condition: "芳乃ENDの後",
					condition_localized: localized("※芳乃线通关后"),
					requires_ending_keys: ["e1"],
				},
			),
			segment("seg3", "s1", node("save", "sv05"), node("collect", null), [
				step("choice", "一旦抜く", "先拔出来"),
			]),
			segment("seg4", "s2", node("save", "sv01"), node("ending", "e4"), [
				step("choice", "ちょっと心配だ", "有点担心"),
			]),
			segment("seg5", "s2", node("entry", "en1"), node("ending", "e3"), [
				step(
					"choice",
					"変なことは言わない方がいいか",
					"奇怪的话还是别说比较好吧",
				),
			]),
		],
	};
}

/**
 * 上游分组把「这一段里出场过的女角」全写进去的图（实测 v50215：叶梦/诗梦/纱由美
 * 三段的 section.character_keys 都挂着 c1/c2/c3）。
 *
 * 用来锁住归属口径：段落终点是结局时按结局的角色算，只有终点不是结局
 * （回收 / 无标注终点）才退回分组；分组没挂角色的段落归「共通 / 其他」。
 */
export function makeSharedSectionChart(): WalkthroughChart {
	return {
		sections: [
			section("s1", "■叶夢ルート", "■叶梦线", ["c1", "c2", "c3"]),
			section("s2", "■詩夢ルート", "■诗梦线", ["c1", "c2", "c3"]),
			section("s3", "■その他", "■其他", []),
		],
		legend: [],
		entries: [
			{
				key: "en1",
				label: "START",
				localized: {},
				unlocked_by_ending_key: null,
			},
		],
		saves: [save("sv01", "◆セーブ01", "◆存档01")],
		endings: [
			ending("e1", "叶夢END", "叶梦END", "heroine", ["c1"]),
			ending("e2", "詩夢END", "诗梦END", "heroine", ["c2"]),
			ending("e6", "ノーマルEND", "普通END", "normal", []),
		],
		segments: [
			segment("g1", "s1", node("entry", "en1"), node("ending", "e1"), [
				step("choice", "釣りを見る", "看钓鱼"),
			]),
			segment("g2", "s2", node("save", "sv01"), node("ending", "e2"), [
				step("choice", "声をかける", "搭话"),
			]),
			// 终点是回收点：归属退回分组，这条回收段被三条线共享
			segment("g3", "s1", node("save", "sv01"), node("collect", null), [
				step("choice", "回収する", "回收"),
			]),
			// 分组没挂角色 → 共通 / 其他
			segment("g4", "s3", node("save", "sv01"), node("ending", "e6"), [
				step("action", "家に帰る", "回家"),
			]),
		],
	};
}

/** 全空图：所有数组都是空的（上游「空数组而不是 null」的契约） */
export function makeEmptyChart(): WalkthroughChart {
	return {
		sections: [],
		legend: [],
		entries: [],
		saves: [],
		endings: [],
		segments: [],
	};
}
