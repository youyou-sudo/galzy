import { generateJSON } from "@tiptap/html";
import { renderToHTMLString } from "@tiptap/static-renderer";
import { RICH_TEXT_RENDER_EXTENSIONS } from "@web/components/editor/extensions";

/** 渲染结果缓存：同一份正文在 SSR / 客户端重复渲染时避免重复解析 */
const renderCache = new Map<string, string>();

/**
 * 用编辑器同一套扩展把（已净化）HTML 静态渲染为编辑器语义输出。
 * SSR 与客户端同构：编辑器挂载前 / 阅读页都用它保证所见即所得。
 */
export function renderHtmlContent(content: string): string {
	const cached = renderCache.get(content);
	if (cached) return cached;

	const html = (() => {
		try {
			const json = generateJSON(content, RICH_TEXT_RENDER_EXTENSIONS);
			return renderToHTMLString({
				extensions: RICH_TEXT_RENDER_EXTENSIONS,
				content: json,
			});
		} catch (e) {
			console.error("[rich-content] 静态渲染失败，退回原文:", e);
			return content;
		}
	})();

	if (renderCache.size > 64) renderCache.clear();
	renderCache.set(content, html);
	return html;
}
