/**
 * 富文本静态渲染（tiptap 渲染链）。
 *
 * 用编辑器同一套扩展把（已净化）HTML 静态渲染为编辑器语义输出，
 * SSR 与客户端同构：编辑器挂载前 / 阅读页都用它保证所见即所得。
 *
 * 注意：tiptap / prosemirror 全家桶体积巨大（~1MB），因此这里全部走
 * 动态 import —— 本模块自身保持轻量，可被首屏组件安全地静态引用；
 * 只有真正渲染 html 正文时才拉取渲染链 chunk。
 *
 * 缓存策略：
 * - renderCache 缓存最终结果（同一份正文 SSR / 客户端重复渲染零开销）；
 * - pendingCache 缓存进行中的 Promise（保证同一内容只解析一次，
 *   且返回值身份稳定，可安全传给 React.use() 在 Suspense 下重试）。
 */

const renderCache = new Map<string, string>();
const pendingCache = new Map<string, Promise<string>>();

/**
 * 渲染 html 正文为编辑器语义输出（异步）。
 * Promise 永不 reject：渲染失败时退回原文，调用方无需捕获。
 */
export function renderHtmlContent(content: string): Promise<string> {
	const cached = renderCache.get(content);
	if (cached) return Promise.resolve(cached);

	const pending = pendingCache.get(content);
	if (pending) return pending;

	const task = (async () => {
		try {
			const [
				{ generateJSON },
				{ renderToHTMLString },
				{ RICH_TEXT_RENDER_EXTENSIONS },
			] = await Promise.all([
				import("@tiptap/html"),
				import("@tiptap/static-renderer"),
				import("@web/components/editor/extensions"),
			]);

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

	if (pendingCache.size > 64) pendingCache.clear();
	pendingCache.set(content, task);

	void task.then((html) => {
		if (renderCache.size > 64) renderCache.clear();
		renderCache.set(content, html);
	});

	return task;
}

/**
 * 预热渲染链：可在路由 loader / 模块挂载时提前触发动态 chunk 加载
 * 与解析，让后续 renderHtmlContent()（React.use()）大概率同步命中缓存，
 * 避免 Suspense 占位闪跳。
 */
export function preloadRichContent(content: string): Promise<string> {
	return renderHtmlContent(content);
}
