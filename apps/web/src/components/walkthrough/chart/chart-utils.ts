import type {
	ChartEndingType,
	ChartLang,
	ChartLocalized,
	ChartNode,
	ChartSegment,
	ChartStats,
	ChartStep,
	ChartText,
	WalkthroughChart,
} from "./types";

/**
 * 中文译文的候选 key。上游用 BCP-47（实测为 zh-Hans），但不同来源/不同版本
 * 可能写成 zh / zh-CN / zh-Hant，所以先精确命中再退回任意 zh* 前缀——
 * 只认 "zh"，不猜其它语种，避免把英文/日文当中文括注出来。
 */
const ZH_KEYS = [
	"zh-hans",
	"zh",
	"zh-cn",
	"zh-sg",
	"zh-hant",
	"zh-tw",
	"zh-hk",
];

/** 取中文译文；没有中文返回 null（绝不返回空串让调用方出现空行） */
export function zhText(
	localized: ChartLocalized | null | undefined,
): string | null {
	if (!localized) return null;
	const entries = Object.entries(localized);
	for (const key of ZH_KEYS) {
		for (const [k, v] of entries) {
			if (k.toLowerCase() === key && v?.value?.trim()) return v.value;
		}
	}
	for (const [k, v] of entries) {
		if (k.toLowerCase().startsWith("zh") && v?.value?.trim()) return v.value;
	}
	return null;
}

/**
 * 三档语言解析。站点面向中文读者，参考站也是中文在前、原文在括号里，
 * 所以 both 的主文取中文、括注取原文；缺少哪一侧就只出有的那侧。
 */
export function resolveText(
	source: string | null | undefined,
	localized: ChartLocalized | null | undefined,
	lang: ChartLang,
): ChartText {
	const src = source?.trim() ? source.trim() : null;
	const zh = zhText(localized)?.trim() ?? null;

	if (lang === "source") return { primary: src ?? zh ?? "", secondary: null };
	if (lang === "zh") return { primary: zh ?? src ?? "", secondary: null };

	// both：两侧都在且内容不同才加括注，否则重复渲染同样的字很蠢
	if (zh && src && zh !== src) return { primary: zh, secondary: src };
	return { primary: zh ?? src ?? "", secondary: null };
}

/** 给一段双语文本套前后缀（「从【…】开始」这类），两侧都带上 */
export function withAffixes(
	prefix: string,
	text: ChartText,
	suffix: string,
): ChartText {
	return {
		primary: `${prefix}${text.primary}${suffix}`,
		secondary: text.secondary ? `${prefix}${text.secondary}${suffix}` : null,
	};
}

/** 结局类型的中文名，用于结局徽章/图例 */
export function endingTypeLabel(type: ChartEndingType): string {
	switch (type) {
		case "heroine":
			return "个人线";
		case "harem":
			return "后宫线";
		case "true":
			return "真结局";
		case "normal":
			return "普通结局";
		case "bad":
			return "坏结局";
		case "after":
			return "后日谈";
		default:
			return "其他结局";
	}
}

/**
 * 结局徽章文案：只给实测过的三种。harem/true/normal/other 在上游样本里没有出现，
 * 文案是推断的，按调研结论「不画徽章更安全」处理，返回 null 表示不渲染。
 */
export function endingTypeBadgeLabel(type: ChartEndingType): string | null {
	switch (type) {
		case "heroine":
			return "个人线";
		case "after":
			return "后日谈";
		case "bad":
			return "坏结局";
		default:
			return null;
	}
}

/**
 * 段落锚点 id：壳的段落导航与流程图点击回跳都靠它，
 * 所以格式必须稳定（不要带序号，列表过滤后序号会变）。
 */
export function segmentAnchorId(segmentKey: string): string {
	return `wt-seg-${segmentKey}`;
}

/** 节点 id：同一节点在不同段落里重复出现，靠这个字符串去重 */
export type ChartNodeId = string;

/** 节点的稳定标识：不同节点类型下 key 可能同名（存档 sv01 与结局 e1） */
export function chartNodeId(node: ChartNode): ChartNodeId {
	return `${node.node_type}:${node.key ?? ""}`;
}

/** 段落按 section_key 找所属分组；没有分组返回 null（无标题的共用段） */
export function segmentSection(chart: WalkthroughChart, segment: ChartSegment) {
	if (!segment.section_key) return null;
	return chart.sections.find((s) => s.key === segment.section_key) ?? null;
}

/**
 * 「共通 / 其他」的合成角色 key。
 *
 * 攻略里总有段落不属于任何角色（普通 END、CG 回收、共同序章）。上游把它们放在
 * 没有 character_keys 的分组里，角色卡上本来没地方放，只能挂在合成 key 上；
 * 它只存在于前端筛选状态（`?character=__common__`），不写回数据。
 */
export const COMMON_CHARACTER_KEY = "__common__";

/**
 * 段落归属的角色 key（空数组 = 共通 / 其他）。
 *
 * 先看段落终点的结局：结局的 character_keys 才真正说明「这段通向谁」，个人线
 * 结局基本一个角色一个。只有终点不是结局（回收 / 无标注终点）或结局在表里找不到
 * 时，才退回原页面的分组（section.character_keys）——上游的分组会把同一段里出场的
 * 女角全写进去（实测 v50215 三段各挂 3 个角色），拿它当归属会把几条线合成一条，
 * 所以只能当兜底。
 *
 * 结局存在但 character_keys 为空时同样以结局为准（= 共通 / 其他）：空数组是上游
 * 对「普通 END / 无标注结局」的明确表达。退回分组会让这类结局挂到分组里出场的
 * 每个角色上（实测 v64683：普通 END 挂在「旅行路线」分组，四个角色线都多出一段）。
 */
export function segmentCharacterKeys(
	chart: WalkthroughChart,
	segment: ChartSegment,
): string[] {
	if (segment.to_node.node_type === "ending") {
		const ending = (chart.endings ?? []).find(
			(item) => item.key === segment.to_node.key,
		);
		if (ending) return ending.character_keys;
	}
	const section = segment.section_key
		? ((chart.sections ?? []).find(
				(item) => item.key === segment.section_key,
			) ?? null)
		: null;
	return section?.character_keys ?? [];
}

/**
 * 按角色过滤段落：只留归属该角色的段落（见 segmentCharacterKeys）。
 *
 * 不属于任何角色的段落不进角色线：它们有自己的「共通 / 其他」入口，
 * 混进每个人的列表会让「N 段」与实际看到的段数对不上。
 * 不传 characterKey 时返回全部（全部路线 / 流程图看全部）。
 */
export function segmentsForCharacter(
	chart: WalkthroughChart,
	characterKey: string | null | undefined,
): ChartSegment[] {
	const segments = chart.segments ?? [];
	if (!characterKey) return segments;
	if (characterKey === COMMON_CHARACTER_KEY) {
		return segments.filter(
			(segment) => segmentCharacterKeys(chart, segment).length === 0,
		);
	}
	return segments.filter((segment) =>
		segmentCharacterKeys(chart, segment).includes(characterKey),
	);
}

/**
 * 段落里「选项」的条数：编号步骤（choice + action）的数量。
 * 存档/小标题/备注不计入，和参考站「16 个选项」的口径一致。
 */
export function segmentOptionCount(segment: ChartSegment): number {
	return (segment.steps ?? []).filter(
		(step) => step.step_type === "choice" || step.step_type === "action",
	).length;
}

/**
 * 每个步骤的编号（null = 不编号）。实测规则：
 * - choice/action 编号；
 * - save/heading/note 不编号；
 * - **遇到 heading 编号从 1 重新开始**（参考站 g1 是 1-8 → ■芳乃线 → 重新 1-8）；
 * - 未知 step_type 只显示文本不编号（spec 要求向前兼容）。
 */
export function stepNumbers(steps: ChartStep[]): (number | null)[] {
	let current = 0;
	return steps.map((step) => {
		if (step.step_type === "heading") {
			current = 0;
			return null;
		}
		if (step.step_type === "choice" || step.step_type === "action") {
			current += 1;
			return current;
		}
		return null;
	});
}

/** 节点显示文本：起点/存档/结局查各自表，回收点与开放终点用固定 UI 文案 */
export function nodeLabel(
	chart: WalkthroughChart,
	node: ChartNode,
	lang: ChartLang,
): ChartText {
	switch (node.node_type) {
		case "entry": {
			const entry = (chart.entries ?? []).find((e) => e.key === node.key);
			return resolveText(entry?.label, entry?.localized, lang);
		}
		case "save": {
			const save = (chart.saves ?? []).find((s) => s.key === node.key);
			return resolveText(save?.label, save?.localized, lang);
		}
		case "ending": {
			const ending = (chart.endings ?? []).find((e) => e.key === node.key);
			return resolveText(ending?.name, ending?.localized, lang);
		}
		case "collect":
			// 上游只给节点类型，没有文本；这两条是本站 UI 文案
			return { primary: "回收 CG / 场景", secondary: null };
		default:
			return { primary: "未标注终点", secondary: null };
	}
}

/**
 * 段落卡片头的起点短语（参考站实测原话）：
 * entry → 从【START】开始 / save → 读取「◆存档05」/ ending → 接在「芳乃END」之后。
 */
export function nodeStartPhrase(
	chart: WalkthroughChart,
	node: ChartNode,
	lang: ChartLang,
): ChartText {
	const label = nodeLabel(chart, node, lang);
	switch (node.node_type) {
		case "entry":
			return withAffixes("从【", label, "】开始");
		case "save":
			return withAffixes("读取「", label, "」");
		case "ending":
			return withAffixes("接在「", label, "」之后");
		default:
			// collect/open 不会作为起点；真出现就只显示标签，不硬编短语
			return label;
	}
}

/**
 * 全量统计 + 每角色统计。角色卡「N 个结局 · N 段」直接用 byCharacter，
 * 「共通 / 其他」卡用 common。段数按 segmentCharacterKeys 的归属算，
 * 与按角色过滤的口径同一个来源——两边各算一次，卡片数与列表长度迟早对不上。
 */
export function chartStats(chart: WalkthroughChart): ChartStats {
	const endings = chart.endings ?? [];
	const segments = chart.segments ?? [];
	const sections = chart.sections ?? [];

	const characterKeys = new Set<string>();
	for (const section of sections) {
		for (const key of section.character_keys) characterKeys.add(key);
	}
	for (const ending of endings) {
		for (const key of ending.character_keys) characterKeys.add(key);
	}

	// 段落归属只算一次：下面按角色筛计数时直接查表，不必每个角色重扫一遍
	const owners = new Map<string, string[]>();
	for (const segment of segments) {
		owners.set(segment.key, segmentCharacterKeys(chart, segment));
	}

	const byCharacter: ChartStats["byCharacter"] = {};
	for (const key of characterKeys) {
		byCharacter[key] = {
			endings: endings.filter((e) => e.character_keys.includes(key)).length,
			segments: segments.filter((segment) =>
				(owners.get(segment.key) ?? []).includes(key),
			).length,
		};
	}

	return {
		endings: endings.length,
		segments: segments.length,
		saves: (chart.saves ?? []).length,
		entries: (chart.entries ?? []).length,
		byCharacter,
		common: {
			// 没挂角色的结局（普通 END / 无标注结局）与段落都归「共通 / 其他」
			endings: endings.filter((ending) => ending.character_keys.length === 0)
				.length,
			segments: segments.filter(
				(segment) => (owners.get(segment.key) ?? []).length === 0,
			).length,
		},
	};
}
/**
 * 流程图上的一条「边」。
 *
 * 上游的 segment 是「段」而不是「边」：一段 22 步里可能声明了好几个存档点
 * （`step_type: save` + `save_key`），下一段就从那个存档点续写。参考站的
 * 流程图正是按存档点切的：START —3 个选项→ ◆存档01 —1 个选项→ ◆存档02 …
 * 所以画图前必须先把段落切成边，否则整段只能画成一条线、存档点全成孤岛
 * （改造前的实现就是这个毛病）。
 */
export interface ChartEdgeChunk {
	/** 稳定 id：`<段落 key>#<段内第几块>`，用来做 hover/选中态与测试断言 */
	id: string;
	/** 这条边来自哪个段落（「在路线列表中查看」要按段落 key 跳锚点） */
	segment: ChartSegment;
	from: ChartNode;
	to: ChartNode;
	/** 这条边自己的步骤（不含末尾那条切分它的 save 步骤） */
	steps: ChartStep[];
	/** choice + action 条数，与连线上「N 个选项」同一口径 */
	optionCount: number;
}

/**
 * 把段落切成边：遇到 save 步骤就收一条边，终点是那个存档节点。
 *
 * 注意这条 save 步骤**不进**边里的 steps —— 它表达的就是「这里是下一个节点」，
 * 再画一遍会变成「存档 01 —> 在这里存档 01」的自我重复。段落末尾剩下的步骤
 * 收给 from → to_node 那条边。
 */
export function chartEdgeChunks(
	chart: WalkthroughChart,
	characterKey?: string | null,
): ChartEdgeChunk[] {
	const chunks: ChartEdgeChunk[] = [];
	for (const segment of segmentsForCharacter(chart, characterKey)) {
		let from = segment.from_node;
		let buffer: ChartStep[] = [];
		let index = 0;
		const push = (to: ChartNode) => {
			chunks.push({
				id: `${segment.key}#${index}`,
				segment,
				from,
				to,
				steps: buffer,
				optionCount: buffer.filter(
					(step) => step.step_type === "choice" || step.step_type === "action",
				).length,
			});
			index += 1;
		};
		for (const step of segment.steps ?? []) {
			if (step.step_type === "save" && step.save_key) {
				const saveNode: ChartNode = { node_type: "save", key: step.save_key };
				push(saveNode);
				from = saveNode;
				buffer = [];
				continue;
			}
			buffer.push(step);
		}
		push(segment.to_node);
	}
	return chunks;
}

/** 连线文案：有选项就报数，没有选项（只有标题/说明）就说「查看步骤」 */
export function edgeOptionLabel(optionCount: number): string {
	return optionCount > 0 ? `${optionCount} 个选项` : "查看步骤";
}
/** 段落分组：同一 section 的连续段落归一组（section 变化就换组，保源文顺序） */
export interface ChartSegmentGroup {
	/** section_key（没有分组的共用段固定 '__none__'） */
	key: string;
	/** 分组标题（section.title 的多语言解析结果） */
	title: ChartText | null;
	segments: ChartSegment[];
}

/**
 * 按 section 把段落分组。顺序视图与「段落目录」共用一套分组口径：
 * 两处各分一次的话，编号与标题迟早会不一致。
 */
export function segmentGroups(
	chart: WalkthroughChart,
	lang: ChartLang,
	characterKey?: string | null,
): ChartSegmentGroup[] {
	const groups: ChartSegmentGroup[] = [];
	for (const segment of segmentsForCharacter(chart, characterKey)) {
		const groupKey = segment.section_key ?? "__none__";
		const last = groups.at(-1);
		if (last && last.key === groupKey) {
			last.segments.push(segment);
			continue;
		}
		const section = segment.section_key
			? ((chart.sections ?? []).find((s) => s.key === segment.section_key) ??
				null)
			: null;
		groups.push({
			key: groupKey,
			title: section
				? resolveText(section.title, section.localized, lang)
				: null,
			segments: [segment],
		});
	}
	return groups;
}
