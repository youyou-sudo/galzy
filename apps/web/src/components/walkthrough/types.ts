import type { WalkthroughChart } from "./chart/types";

/**
 * 条目页「攻略」页签的视图类型与展示规则。
 *
 * 与 characters/character-types.ts 同一思路：页面只吃归一化后的视图对象，
 * 后端 DTO 字段改名时只改本文件，列表页/详情页外壳一律不动。
 *
 * 两套命名要分清：
 * - **摘要**（下面的类型）消费的是 BFF 的 camelCase DTO
 *   （apps/api/src/modules/walkthroughs/service.ts 的 WalkthroughSummaryDTO）；
 * - **chart** 是 upstream JSON 整块透传，保持 snake_case（step_type /
 *   from_node / character_keys …），语义由 components/walkthrough/chart 解释，
 *   这里只做空值兜底、绝不改名。
 */

/** 三视图（写进 ?view=）：按角色 / 按顺序 / 流程图 */
export const WALKTHROUGH_VIEWS = ["character", "order", "graph"] as const;

export type WalkthroughView = (typeof WALKTHROUGH_VIEWS)[number];

export const WALKTHROUGH_VIEW_LABELS: Record<WalkthroughView, string> = {
	character: "按角色",
	order: "按顺序",
	graph: "流程图",
};

export function isWalkthroughView(value: unknown): value is WalkthroughView {
	return WALKTHROUGH_VIEWS.includes(value as WalkthroughView);
}

/**
 * 三档语言（写进 ?lang=）：中文 / 原文 / 双语。
 *
 * 顺序即界面顺序：站点面向中文读者，默认看中文，缺中文时 resolveText 自动
 * 回退原文；「双语」（中文主文 + 括号原文）是给核对原文的人用的第三档。
 */
export const WALKTHROUGH_LANGS = ["zh", "source", "both"] as const;

export type WalkthroughLang = (typeof WALKTHROUGH_LANGS)[number];

export const WALKTHROUGH_LANG_LABELS: Record<WalkthroughLang, string> = {
	zh: "中文",
	source: "原文",
	both: "双语",
};

export function isWalkthroughLang(value: unknown): value is WalkthroughLang {
	return WALKTHROUGH_LANGS.includes(value as WalkthroughLang);
}

/** chart 里的一个角色（key 是 chart 局部 key，如 c1） */
export type WalkthroughCharacter = {
	key: string;
	/** 原文页写的名字（未本地化） */
	name: string;
	/** 绑定的 kungal 角色展示名；未钉到目录角色时为 null */
	displayName?: string | null;
	/** characters[].localized 里的中文机翻名，displayName 缺失时兜底 */
	zhName?: string | null;
	characterId?: string | null;
};

/** 攻略对应的发行版（官方版 / 汉化补丁等），用于概览块的「制作会社」 */
export type WalkthroughRelease = {
	id?: string | null;
	title?: string | null;
	lang?: string | null;
	/** default | digital | physical | trial | patch（patch 含汉化补丁） */
	kind?: string | null;
	/** 发行/补丁组名 */
	companies: string[];
};

/** 列表卡与详情头共用的摘要 */
export type WalkthroughSummary = {
	id: string;
	/** 正文语言（BCP-47）：ja / zh-Hans …；null 表示未记录 */
	lang: string | null;
	/** 开放词汇的来源站名，或 nextmoe（本站撰写）。判断「本站撰写」要用 sourceUrl === null */
	source: string | null;
	/** 原攻略页面地址；本站撰写的为 null */
	sourceUrl: string | null;
	/** 原页面署名作者 */
	sourceAuthor: string | null;
	/** 原页面自称的更新日期（YYYY-MM-DD 日期串） */
	sourceUpdatedOn: string | null;
	endingCount: number;
	saveCount: number;
	segmentCount: number;
	characterCount: number;
	/** 上游最后更新时间（ISO 串），列表按它倒序 */
	updatedAt: string | null;
};

/** 详情页要的全部数据 */
export type WalkthroughDetail = WalkthroughSummary & {
	workId: string | null;
	characters: WalkthroughCharacter[];
	chart: WalkthroughChart | null;
	release: WalkthroughRelease | null;
	/** 上游提示「游戏本身就会给路线提示」：展示路线前应告知玩家 */
	workRouteHints: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function asText(value: unknown): string | null {
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : null;
	}
	// id 可能是数字（上游是十进制字符串，同步层偶尔给 number）
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return null;
}

function asCount(value: unknown): number {
	const count = typeof value === "number" ? value : Number(value);
	return Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0;
}

function asList(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

/**
 * localized 里的中文译文。
 *
 * 键是 BCP-47 且可能写成 zh / zh-Hans / zh-CN：只认 zh* 前缀，
 * 不猜别的语种（猜错就会把日文当中文显示）。
 */
function zhTextOf(localized: unknown): string | null {
	const record = asRecord(localized);
	if (!record) return null;
	for (const [key, value] of Object.entries(record)) {
		if (!key.toLowerCase().startsWith("zh")) continue;
		const text = asText(asRecord(value)?.value);
		if (text) return text;
	}
	return null;
}

function readCharacter(value: unknown): WalkthroughCharacter | null {
	const record = asRecord(value);
	if (!record) return null;
	const key = asText(record.key);
	if (!key) return null;
	return {
		key,
		name: asText(record.name) ?? key,
		displayName: asText(record.displayName),
		zhName: zhTextOf(record.localized),
		characterId: asText(record.characterId),
	};
}

function readRelease(value: unknown): WalkthroughRelease | null {
	const record = asRecord(value);
	if (!record) return null;
	return {
		id: asText(record.id),
		title: asText(record.title),
		lang: asText(record.lang),
		kind: asText(record.releaseKind),
		companies: asList(record.companies)
			.map(asText)
			.filter((name): name is string => name !== null),
	};
}

/** 单条摘要；没有 id 的脏数据直接丢弃（详情页路由需要它） */
function readSummary(value: unknown): WalkthroughSummary | null {
	const record = asRecord(value);
	if (!record) return null;
	const id = asText(record.id);
	if (!id) return null;

	// 详情会带 chart：计数缺失时就地数一遍数组长度，不额外解析图结构
	const chart = asRecord(record.chart);
	const characters = asList(record.characters);

	return {
		id,
		lang: asText(record.lang),
		source: asText(record.source),
		sourceUrl: asText(record.sourceUrl),
		sourceAuthor: asText(record.sourceAuthor),
		sourceUpdatedOn: asText(record.sourceUpdatedOn),
		endingCount: asCount(record.endingCount) || asList(chart?.endings).length,
		saveCount: asCount(record.saveCount) || asList(chart?.saves).length,
		segmentCount:
			asCount(record.segmentCount) || asList(chart?.segments).length,
		characterCount: characters.length,
		updatedAt: asText(record.upstreamUpdatedAt),
	};
}

/**
 * 攻略列表。
 *
 * BFF 直接把 API 的 `{ gameId, workId, items }` 透传下来；也接受裸数组，
 * 免得以后换成别的包装形状时列表页跟着改。
 */
export function readWalkthroughList(data: unknown): WalkthroughSummary[] {
	const record = asRecord(data);
	const rows = Array.isArray(data) ? data : asList(record?.items);
	return rows
		.map(readSummary)
		.filter((item): item is WalkthroughSummary => item !== null);
}

/** 攻略详情；没有 id 时返回 null（页面退化成空态） */
export function readWalkthroughDetail(data: unknown): WalkthroughDetail | null {
	const record = asRecord(data);
	if (!record) return null;
	const summary = readSummary(record);
	if (!summary) return null;

	const chart = asRecord(record.chart);
	return {
		...summary,
		workId: asText(record.workId),
		characters: asList(record.characters)
			.map(readCharacter)
			.filter((item): item is WalkthroughCharacter => item !== null),
		// chart 是上游结构直出：这里只转换空值，字段语义交给 chart/ 的组件
		chart: chart ? (chart as unknown as WalkthroughChart) : null,
		release: readRelease(record.release),
		workRouteHints: record.workRouteHints === true,
	};
}

const LANG_LABELS: Record<string, string> = {
	ja: "日文",
	jp: "日文",
	zh: "中文",
	en: "英文",
	ko: "韩文",
};

/** BCP-47（ja / ja-JP / zh-Hans …）→ 中文名；未收录的主语言原样返回 */
export function langLabelOf(lang: string | null | undefined): string | null {
	const value = lang?.trim();
	if (!value) return null;
	const primary = value.toLowerCase().split(/[-_]/)[0];
	return LANG_LABELS[primary] ?? value;
}

/** 列表卡标题：日文攻略 / 中文攻略 …；语言缺失时只叫「攻略」 */
export function walkthroughTitleOf(summary: WalkthroughSummary): string {
	const lang = langLabelOf(summary.lang);
	return lang ? `${lang}攻略` : "攻略";
}

/**
 * 来源站展示名。
 *
 * 参考站按自己的私有映射把 seiya 显示成「誠也の部屋」，我们不做这层伪造：
 * 有署名就用署名，否则退到外链域名，再否则用 source 原值。列表卡与概览卡
 * 共用这一份，避免两处文案漂移。
 */
export function sourceNameOf(
	summary: Pick<WalkthroughSummary, "source" | "sourceAuthor" | "sourceUrl">,
): string | null {
	if (summary.sourceAuthor) return summary.sourceAuthor;
	if (summary.sourceUrl) {
		try {
			return new URL(summary.sourceUrl).hostname;
		} catch {
			// sourceUrl 不是合法 URL：继续退到 source 原值
		}
	}
	return summary.source ?? null;
}

/** 角色名：目录名 → 中文机翻名 → 原文页写法（逐级兜底） */
export function characterNameOf(character: WalkthroughCharacter): string {
	return (
		character.displayName?.trim() || character.zhName?.trim() || character.name
	);
}

/** 「13 个结局 · 7 个存档点 · 6 名角色」，0 的项不显示 */
export function countsLine(summary: WalkthroughSummary): string {
	const parts: string[] = [];
	if (summary.endingCount > 0) parts.push(`${summary.endingCount} 个结局`);
	if (summary.saveCount > 0) parts.push(`${summary.saveCount} 个存档点`);
	if (summary.characterCount > 0)
		parts.push(`${summary.characterCount} 名角色`);
	return parts.join(" · ");
}

/** 角色卡副信息：「3 个结局 · 5 段」 */
export function routeCountsLine(endings: number, segments: number): string {
	const parts: string[] = [];
	if (endings > 0) parts.push(`${endings} 个结局`);
	if (segments > 0) parts.push(`${segments} 段`);
	return parts.join(" · ");
}

/** 概览块的计数项（拆成数组，渲染时逐项上标） */
export function countItemsOf(summary: WalkthroughSummary): string[] {
	const items: string[] = [];
	if (summary.endingCount > 0) items.push(`${summary.endingCount} 个结局`);
	if (summary.saveCount > 0) items.push(`${summary.saveCount} 个存档点`);
	if (summary.characterCount > 0)
		items.push(`${summary.characterCount} 名角色`);
	return items;
}

/** YYYY-MM-DD / ISO → 「2020-02-15」；无法识别时原样返回 */
export function formatDate(value: string | null | undefined): string | null {
	const text = value?.trim();
	if (!text) return null;
	const matched = text.match(/^(\d{4}-\d{2}-\d{2})/);
	return matched ? matched[1] : text;
}
