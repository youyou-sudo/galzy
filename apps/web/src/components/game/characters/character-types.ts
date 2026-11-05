/**
 * 条目页「详情」页签的角色视图类型与展示规则。
 *
 * 这里刻意不 import 后端类型：页面只吃「归一化后的视图对象」，API/DTO 字段
 * 改名时只需要改本文件的 `toCharacterView`，卡片/列表/弹窗一律不动。
 */

/** 角色身份（列表分组维度） */
export const CHARACTER_ROLES = ["main", "secondary", "appears"] as const;

export type CharacterRole = (typeof CHARACTER_ROLES)[number];

/** 剧透等级：none 不提示，minor/major 在卡片上打标 */
export type CharacterSpoiler = "none" | "minor" | "major";

/** 三围：kungal 侧是 bust_cm / waist_cm / hip_cm / cup */
export type CharacterMeasurements = {
	bustCm?: number | null;
	waistCm?: number | null;
	hipCm?: number | null;
	cup?: string | null;
};

/** 属性词条（kungal Trait 的展示子集） */
export type CharacterTrait = {
	id?: string | null;
	displayName?: string | null;
	nameZh?: string | null;
	isSexual?: boolean | null;
};

/** 角色卡片 / 弹窗共用的视图对象（名册行 + view=full 的并集） */
export type CharacterView = {
	id: string;
	name: string;
	latin?: string | null;
	localized?: string | null;
	gender?: string | null;
	/** MM-DD（无年份） */
	birthday?: string | null;
	bloodType?: string | null;
	heightCm?: number | null;
	weightKg?: number | null;
	measurements?: CharacterMeasurements | null;
	imageUrl?: string | null;
	imageWidth?: number | null;
	imageHeight?: number | null;
	imageThumbhash?: string | null;
	intro?: string | null;
	traits?: CharacterTrait[] | null;
	rosterRole?: CharacterRole | null;
	spoiler?: CharacterSpoiler | null;
};

/** 出演作品（/characters/info 的 appearances） */
export type CharacterAppearanceView = {
	/** 该作品在站内的展示 id（vNNN / kgX） */
	displayId: string;
	displayName: string;
	rosterRole?: CharacterRole | null;
	spoiler?: CharacterSpoiler | null;
};

/** /characters/info 的视图对象：名册字段 + 出演作品 */
export type CharacterInfoView = CharacterView & {
	appearances?: CharacterAppearanceView[] | null;
};

/**
 * 身份徽章文案：名册只有 main / secondary / appears 三档，
 * 展示上收敛成两档「主角 / 配角」—— 不再按身份拆分组标题。
 */
export const CHARACTER_ROLE_LABELS: Record<CharacterRole, string> = {
	main: "主角",
	secondary: "配角",
	appears: "配角",
};

const SPOILER_LABELS: Record<CharacterSpoiler, string> = {
	none: "",
	minor: "剧透",
	major: "重度剧透",
};

function asString(value: unknown): string | null {
	return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function asRole(value: unknown): CharacterRole | null {
	return typeof value === "string" &&
		(CHARACTER_ROLES as readonly string[]).includes(value)
		? (value as CharacterRole)
		: null;
}

function asSpoiler(value: unknown): CharacterSpoiler | null {
	return value === "none" || value === "minor" || value === "major"
		? value
		: null;
}

/** localized 在 kungal 侧是 Record<lang, { value, is_machine }>，取中文优先 */
function pickLocalized(value: unknown): string | null {
	const record = asRecord(value);
	if (!record) return null;
	for (const lang of ["zh-Hans", "zh-CN", "zh", "zh-Hant", "ja", "en"]) {
		const entry = record[lang];
		const text = asString(asRecord(entry)?.value ?? entry);
		if (text) return text;
	}
	for (const entry of Object.values(record)) {
		const text = asString(asRecord(entry)?.value ?? entry);
		if (text) return text;
	}
	return null;
}

function toMeasurements(value: unknown): CharacterMeasurements | null {
	const record = asRecord(value);
	if (!record) return null;
	const measurements: CharacterMeasurements = {
		bustCm: asNumber(record.bustCm ?? record.bust_cm ?? record.bust),
		waistCm: asNumber(record.waistCm ?? record.waist_cm ?? record.waist),
		hipCm: asNumber(record.hipCm ?? record.hip_cm ?? record.hip),
		cup: asString(record.cup),
	};
	return measurements.bustCm === null &&
		measurements.waistCm === null &&
		measurements.hipCm === null &&
		!measurements.cup
		? null
		: measurements;
}

function toTraits(value: unknown): CharacterTrait[] | null {
	if (!Array.isArray(value)) return null;
	const traits: CharacterTrait[] = [];
	for (const entry of value) {
		const record = asRecord(entry);
		if (!record) continue;
		const displayName = asString(
			record.displayName ?? record.display_name ?? record.name,
		);
		const nameZh = asString(record.nameZh ?? record.name_zh);
		if (!displayName && !nameZh) continue;
		const sexual = record.isSexual ?? record.is_sexual;
		traits.push({
			id: asString(record.id),
			displayName,
			nameZh,
			isSexual: typeof sexual === "boolean" ? sexual : null,
		});
	}
	return traits.length > 0 ? traits : null;
}

/** 归一化单个角色（名册行或 view=full 的响应都可以喂进来） */
export function toCharacterView(value: unknown): CharacterView | null {
	const record = asRecord(value);
	if (!record) return null;
	const id = asString(record.id ?? record.characterId ?? record.character_id);
	if (!id) return null;
	const latin = asString(record.latin);
	const localized = pickLocalized(record.localized);
	const name =
		asString(record.name) ??
		asString(record.displayName ?? record.display_name) ??
		localized ??
		latin ??
		"未知角色";
	const image = asRecord(record.image);

	return {
		id,
		name,
		latin,
		localized,
		gender: asString(record.gender),
		birthday: asString(record.birthday),
		bloodType: asString(record.bloodType ?? record.blood_type),
		heightCm: asNumber(record.heightCm ?? record.height_cm),
		weightKg: asNumber(record.weightKg ?? record.weight_kg),
		measurements: toMeasurements(record.measurements),
		imageUrl:
			asString(record.imageUrl ?? record.image_url) ?? asString(image?.url),
		imageWidth:
			asNumber(record.imageWidth ?? record.image_width) ??
			asNumber(image?.width),
		imageHeight:
			asNumber(record.imageHeight ?? record.image_height) ??
			asNumber(image?.height),
		imageThumbhash:
			asString(record.imageThumbhash ?? record.image_thumbhash) ??
			asString(image?.thumbhash),
		intro: asString(record.intro),
		traits: toTraits(record.traits),
		rosterRole: asRole(record.rosterRole ?? record.roster_role),
		spoiler: asSpoiler(record.spoiler),
	};
}

/** 归一化 /characters/game 的响应体 */
export function readCharacterList(payload: unknown): CharacterView[] {
	const record = asRecord(payload);
	if (!record) return [];
	const rows = record.characters;
	if (!Array.isArray(rows)) return [];
	const seen = new Set<string>();
	const list: CharacterView[] = [];
	for (const row of rows) {
		const character = toCharacterView(row);
		if (!character || seen.has(character.id)) continue;
		seen.add(character.id);
		list.push(character);
	}
	return list;
}

/** 归一化出演作品行（appearances） */
function toAppearanceView(value: unknown): CharacterAppearanceView | null {
	const record = asRecord(value);
	if (!record) return null;
	const work = asRecord(record.work);
	const displayId = asString(
		record.displayId ??
			record.display_id ??
			record.workId ??
			record.work_id ??
			work?.displayId ??
			work?.display_id ??
			work?.id,
	);
	if (!displayId) return null;
	const localized = pickLocalized(work?.localized);
	const displayName =
		asString(record.displayName ?? record.display_name) ??
		asString(work?.displayName ?? work?.display_name) ??
		asString(work?.title) ??
		localized ??
		displayId;
	return {
		displayId,
		displayName,
		rosterRole: asRole(record.rosterRole ?? record.roster_role),
		spoiler: asSpoiler(record.spoiler),
	};
}

/** 归一化 /characters/info 的响应体（在名册字段上补 appearances） */
export function toCharacterInfoView(value: unknown): CharacterInfoView | null {
	const character = toCharacterView(value);
	if (!character) return null;
	const record = asRecord(value);
	const rows = Array.isArray(record?.appearances) ? record.appearances : [];
	const appearances = rows
		.map(toAppearanceView)
		.filter((item): item is CharacterAppearanceView => item !== null);
	return { ...character, appearances };
}

/** 卡片上的身份徽章文案：未知身份不显示 */
export function roleLabelOf(role: CharacterRole | null | undefined): string {
	return role ? CHARACTER_ROLE_LABELS[role] : "";
}

/** 卡片上的剧透徽章文案：none 不显示 */
export function spoilerLabelOf(
	spoiler: CharacterSpoiler | null | undefined,
): string {
	return spoiler ? SPOILER_LABELS[spoiler] : "";
}

const GENDER_LABELS: Record<string, string> = {
	male: "男",
	m: "男",
	female: "女",
	f: "女",
	other: "其他",
	nonbinary: "其他",
	non_binary: "其他",
	unknown: "未知",
};

/** gender → 中文；未收录的取值原样返回 */
export function formatGender(gender: string | null | undefined): string | null {
	const value = gender?.trim();
	if (!value) return null;
	return GENDER_LABELS[value.toLowerCase()] ?? value;
}

/** birthday(MM-DD) → 「3月14日」；非法/缺失返回 null（生日不含年份） */
export function formatBirthday(
	birthday: string | null | undefined,
): string | null {
	const value = birthday?.trim();
	if (!value) return null;
	const matched = value.match(/(\d{1,2})-(\d{1,2})$/);
	if (!matched) return value;
	const month = Number(matched[1]);
	const day = Number(matched[2]);
	if (month < 1 || month > 12 || day < 1 || day > 31) return value;
	return `${month}月${day}日`;
}

/** blood_type('a') → 'A' */
export function formatBloodType(
	bloodType: string | null | undefined,
): string | null {
	const value = bloodType?.trim();
	return value ? value.toUpperCase() : null;
}

/** 三围 → 「B88 / W58 / H86（C）」；全空返回 null */
export function formatMeasurements(
	measurements: CharacterMeasurements | null | undefined,
): string | null {
	if (!measurements) return null;
	const parts: string[] = [];
	if (measurements.bustCm != null) parts.push(`B${measurements.bustCm}`);
	if (measurements.waistCm != null) parts.push(`W${measurements.waistCm}`);
	if (measurements.hipCm != null) parts.push(`H${measurements.hipCm}`);
	if (parts.length === 0) return measurements.cup ?? null;
	const cup = measurements.cup ? `（${measurements.cup}）` : "";
	return `${parts.join(" / ")}${cup}`;
}
