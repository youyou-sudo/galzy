type GameTitleEntry = {
	lang?: string | null;
	title?: string | null;
};

type GameTitleSource =
	| {
			vn?: {
				olang?: string | null;
				titles?: GameTitleEntry[] | null;
			} | null;
	  }
	| null
	| undefined;

/** 中文标题优先级：简体 → 泛中文 → 繁体（统一小写，便于与语言码归一后比较） */
const ZH_TITLE_LANGS = ["zh-hans", "zh", "zh-hant"] as const;

/** 语言码归一：去空白 + 小写，容忍 zh-Hans / ZH-hans / zh_Hans 这类写法差异 */
function langOf(entry: GameTitleEntry): string | undefined {
	return entry.lang?.trim().toLowerCase() || undefined;
}

function titleOf(entry: GameTitleEntry | undefined): string | undefined {
	const title = entry?.title?.trim();
	return title || undefined;
}

/** 按谓词找第一条有非空标题的行（同一语言可能有多行，空标题行跳过） */
function findTitle(
	rows: readonly GameTitleEntry[],
	match: (entry: GameTitleEntry) => boolean,
): string | undefined {
	for (const row of rows) {
		if (!match(row)) continue;
		const title = titleOf(row);
		if (title) return title;
	}
	return undefined;
}

/**
 * 从标题行里挑展示标题：中文优先（简体 → 泛中文 → 繁体 → 其它 zh-*），
 * 其次 olang 官方标题，最后任意非空标题。
 *
 * 列表卡片、详情页、面包屑、页面 meta 共用这一条兜底链 —— 否则会出现
 * 「列表是日文原名、详情页是中文名」这类不一致。
 */
export function preferredTitleFrom(
	titles: readonly GameTitleEntry[] | null | undefined,
	olang?: string | null,
): string | undefined {
	const rows = titles ?? [];

	for (const lang of ZH_TITLE_LANGS) {
		const title = findTitle(rows, (item) => langOf(item) === lang);
		if (title) return title;
	}

	// zh-CN / zh-TW / zh-Hans-CN 等其它中文变体
	const otherZh = findTitle(rows, (item) =>
		(langOf(item) ?? "").startsWith("zh"),
	);
	if (otherZh) return otherZh;

	const olangKey = olang?.trim().toLowerCase();
	if (olangKey) {
		const title = findTitle(rows, (item) => langOf(item) === olangKey);
		if (title) return title;
	}

	return findTitle(rows, () => true);
}

/** 条目（`vn` 形状）的展示标题：等价于 `preferredTitleFrom(vn.titles, vn.olang)`。 */
export function preferredGameTitle(game: GameTitleSource): string | undefined {
	return preferredTitleFrom(game?.vn?.titles, game?.vn?.olang);
}
