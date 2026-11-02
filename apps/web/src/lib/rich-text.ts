/**
 * 富文本（TipTap）内容与 Markdown 之间的转换。
 *
 * - markdownToHtml: 存量 Markdown 帖子进入富文本编辑器前先转成 HTML
 *   （TipTap 只认 HTML / JSON，不认 Markdown 源码）
 * - htmlToPlainText: 校验 / 摘要时剥离标签得到纯文本
 */
import rehypeStringify from "rehype-stringify";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

/** 存量 Markdown → HTML（含 GFM + 单换行保留），供 TipTap 初始化 */
export function markdownToHtml(markdown: string): string {
	const file = unified()
		.use(remarkParse)
		.use(remarkGfm)
		.use(remarkBreaks)
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypeStringify, { allowDangerousHtml: true })
		.processSync(markdown);
	return String(file);
}

/** HTML → 纯文本（剥离标签 + 解码常见实体，合并空白） */
export function htmlToPlainText(html: string): string {
	return html
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi, " ")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\s+/g, " ")
		.trim();
}
