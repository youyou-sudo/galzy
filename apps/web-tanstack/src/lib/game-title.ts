type GameTitleSource =
	| {
			vn?: {
				olang?: string | null;
				titles?: Array<{
					lang?: string | null;
					title?: string | null;
				}> | null;
			} | null;
	  }
	| null
	| undefined;

/** 中文标题优先级：简体 → 泛中文 → 繁体 */
const ZH_TITLE_LANGS = ["zh-Hans", "zh", "zh-Hant"] as const;

/**
 * 条目展示标题：优先中文标题，其次 olang 官方标题，最后任意非空标题。
 *
 * 详情页、面包屑、页面 meta 都用这一份，避免「标题是日文、面包屑是中文」
 * 这类不一致。列表卡片仍沿用 olang 标题（榜单/搜索结果按原文识别更稳）。
 */
export function preferredGameTitle(game: GameTitleSource): string | undefined {
	const titles = game?.vn?.titles ?? [];

	for (const lang of ZH_TITLE_LANGS) {
		const title = titles.find(
			(item) => item.lang === lang && item.title?.trim(),
		)?.title;
		if (title) return title.trim();
	}

	const olang = game?.vn?.olang;
	if (olang) {
		const title = titles.find(
			(item) => item.lang === olang && item.title?.trim(),
		)?.title;
		if (title) return title.trim();
	}

	return titles.find((item) => item.title?.trim())?.title?.trim();
}
