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

/** 生成统一的 SEO head：title + description + robots + OG + canonical */
export function seoMeta({ title, description, path, type = "website", noindex }: SeoOptions) {
	const url = path ? `${seoTemplate.siteUrl}${path}` : undefined;
	const meta: HeadTag[] = [
		{ title },
		...(description ? [{ name: "description", content: description }] : []),
		...(noindex ? [{ name: "robots", content: "noindex, nofollow" }] : []),
		{ property: "og:type", content: type },
		{ property: "og:title", content: title },
		...(description ? [{ property: "og:description", content: description }] : []),
		...(url ? [{ property: "og:url", content: url }] : []),
	];
	const links = url ? [{ rel: "canonical", href: url }] : [];
	return { meta, links };
}
