import { seoTemplate } from "@web/config/seoTemplate";

type SeoOptions = {
	title: string;
	description?: string;
	/** 页面路径（含前导斜杠），用于生成 canonical 与 og:url，如 "/games" */
	path?: string;
	type?: "website" | "article";
	/** 登录后可见/后台页面设为 true，输出 noindex */
	noindex?: boolean;
};

type HeadTag = Record<string, string>;

/** 去除 Markdown 语法，得到可用于 meta description 的纯文本 */
export function stripMarkdown(text: string): string {
	return text
		.replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/[#>*_`~|-]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/** 截断为纯文本摘要（meta description 建议不超过 ~120 字） */
export function truncateText(text: string, max = 120): string {
	const clean = stripMarkdown(text);
	return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/** 从 game detail 取官方语言标题（与 vn.olang 一致），无则回退 "Galgame" */
export function gameTitleOf(
	game:
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
		| undefined,
): string {
	const vn = game?.vn;
	const title = vn?.titles?.find(
		(t) => t.lang === vn?.olang && t.title?.trim() !== "",
	)?.title;
	return title || "Galgame";
}

type LayoutGameMatch = { routeId: string; loaderData?: unknown };

/** 从 route head 的 matches 中取父布局（/$id/_layout）loader 已加载的 game detail，
 *  供子路由复用标题，避免每个 tab 重复请求 game detail。 */
export function parentGameFromMatches(
	matches: ReadonlyArray<LayoutGameMatch>,
): GameTitleSource | undefined {
	const match = matches.find((m) => m.routeId === "/$id/_layout");
	if (
		match &&
		typeof match === "object" &&
		"loaderData" in match &&
		match.loaderData &&
		typeof match.loaderData === "object" &&
		"game" in match.loaderData
	) {
		const game = match.loaderData.game;
		if (game && typeof game === "object") return game;
	}
	return undefined;
}

type GameTitleSource = {
	vn?: {
		olang?: string | null;
		titles?: Array<{ lang?: string | null; title?: string | null }>;
	};
};

/** 生成统一的 SEO head：title + description + robots + OG + canonical */
export function seoMeta({
	title,
	description,
	path,
	type = "website",
	noindex,
}: SeoOptions) {
	const url = path ? `${seoTemplate.siteUrl}${path}` : undefined;
	const meta: HeadTag[] = [
		{ title },
		...(description ? [{ name: "description", content: description }] : []),
		...(noindex ? [{ name: "robots", content: "noindex, nofollow" }] : []),
		{ property: "og:type", content: type },
		{ property: "og:title", content: title },
		...(description
			? [{ property: "og:description", content: description }]
			: []),
		...(url ? [{ property: "og:url", content: url }] : []),
	];
	const links = url ? [{ rel: "canonical", href: url }] : [];
	return { meta, links };
}
