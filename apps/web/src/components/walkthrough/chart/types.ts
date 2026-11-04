/**
 * kungal v2 walkthrough chart 的原始类型。
 *
 * 这里刻意保留上游的 snake_case（step_type / from_node / character_keys /
 * save_key / condition_localized …）：DTO 就是上游 JSON 直出，前端再转一层
 * camelCase 只会多一份需要同步的映射——接口加字段就要改两个地方，而且转换
 * 代码本身不做任何校验。字段语义见 docs/kungal-walkthroughs-api.md。
 *
 * 所有数组字段在上游契约里都是「空数组而不是 null」，所以这里写死为非空类型。
 */

/** 一条机翻文本：value 是译文，is_machine 标记是否机翻（参考站据此淡化显示） */
export interface ChartLocalizedText {
	value: string;
	is_machine: boolean;
}

/** BCP-47 → 译文。没有译文时是空对象，绝不是 null */
export type ChartLocalized = Record<string, ChartLocalizedText>;

/** 双语三档：both 中文主文 + 括注原文 / source 只原文 / zh 只中文 */
export type ChartLang = "both" | "source" | "zh";

export type ChartStepType = "choice" | "action" | "save" | "heading" | "note";

export type ChartNodeType = "entry" | "save" | "ending" | "collect" | "open";

export type ChartEndingType =
	| "heroine"
	| "harem"
	| "true"
	| "normal"
	| "bad"
	| "after"
	| "other";

/** 差分 CG 回收时改选的另一个选项 */
export interface ChartAlternative {
	text: string;
	localized: ChartLocalized;
}

/** 一段流程里的一步：选项 / 行动 / 存档 / 小标题 / 备注 */
export interface ChartStep {
	step_type: ChartStepType;
	/** 原文（chart.lang 决定是日文还是中文）；save/heading 之外可能为 null */
	text: string | null;
	localized: ChartLocalized;
	alternatives: ChartAlternative[];
	/** 后果标签，如「芳乃+1」「副+1」 */
	remark: string | null;
	remark_localized: ChartLocalized;
	achievement: boolean;
	/** save 步骤创建的存档点，指向 saves[].key */
	save_key: string | null;
}

/** 流程图的端点：起点 / 存档 / 结局 / 回收点 / 无标注结束 */
export interface ChartNode {
	key: string | null;
	node_type: ChartNodeType;
}

/** 两节点之间的一串步骤，即流程图的一条有向边 */
export interface ChartSegment {
	key: string;
	section_key: string | null;
	from_node: ChartNode;
	to_node: ChartNode;
	condition: string | null;
	condition_localized: ChartLocalized;
	/** 达成这些结局之后才能进入本段 */
	requires_ending_keys: string[];
	steps: ChartStep[];
}

/** 原文页面的分组标题，通常一条路线一个 */
export interface ChartSection {
	key: string;
	title: string;
	localized: ChartLocalized;
	/** 指向 walkthrough.characters[].key；为空表示这是全线共用段 */
	character_keys: string[];
}

/** 可重开的起点（标题画面 / 通关后解锁的重开点） */
export interface ChartEntry {
	key: string;
	label: string;
	localized: ChartLocalized;
	unlocked_by_ending_key: string | null;
}

export interface ChartEnding {
	key: string;
	name: string;
	localized: ChartLocalized;
	ending_type: ChartEndingType;
	character_keys: string[];
}

export interface ChartSave {
	key: string;
	label: string;
	localized: ChartLocalized;
}

/** 原文页面对符号（★、⇒ 等）的一条自定义说明 */
export interface ChartLegendLine {
	text: string;
	localized: ChartLocalized;
}

/** 一份完整的选项流程图 */
export interface WalkthroughChart {
	sections: ChartSection[];
	legend: ChartLegendLine[];
	entries: ChartEntry[];
	saves: ChartSave[];
	endings: ChartEnding[];
	segments: ChartSegment[];
}

/** 解析后的文本：primary 是当前语言的主文，secondary 是括注原文（没有则为 null） */
export interface ChartText {
	primary: string;
	secondary: string | null;
}

/** 单个角色的统计，给角色卡「N 个结局 · N 段」用 */
export interface ChartCharacterStats {
	endings: number;
	segments: number;
}

/** 全量统计 + 每角色统计 */
export interface ChartStats {
	endings: number;
	segments: number;
	saves: number;
	entries: number;
	byCharacter: Record<string, ChartCharacterStats>;
}
