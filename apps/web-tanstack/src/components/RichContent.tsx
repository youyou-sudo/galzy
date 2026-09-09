/**
 * 富文本渲染：按 contentType 智能渲染帖子 / 文章正文。
 *
 * - markdown：走 SmartMarkdown（纯文本 / Markdown 智能检测）
 * - html：先用编辑器同一套扩展（@tiptap/html generateJSON）把已净化 HTML
 *   解析为文档，再用 @tiptap/static-renderer（renderToHTMLString）按扩展的
 *   renderHTML 输出 —— 与编辑器内所见完全一致（图片对齐、代码块、引用等）。
 *
 * tiptap 渲染链走动态 import（见 lib/rich-content-render.ts），因此 html
 * 分支用 React.use() + 内置 Suspense 消费缓存的 Promise：首次渲染显示同
 * 结构空占位，模块就绪后无缝替换；结果有缓存，重复渲染零开销。
 */

import { SmartMarkdown } from "@web/components/SmartMarkdown";
import { renderHtmlContent } from "@web/lib/rich-content-render";
import { cn } from "@web/lib/utils";
import { Suspense, use } from "react";

export type RichContentType = "markdown" | "html";

const htmlProseClass =
	"prose prose-sm sm:prose-base dark:prose-invert max-w-none break-words";

function StaticHtmlContent({
	content,
	className,
}: {
	content: string;
	className?: string;
}) {
	const html = use(renderHtmlContent(content));

	return (
		<div
			className={cn(htmlProseClass, className)}
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}

export function RichContent({
	content,
	contentType = "markdown",
	className,
}: {
	content?: string | null;
	contentType?: RichContentType | null;
	className?: string;
}) {
	if (!content) return null;

	if (contentType === "html") {
		return (
			<Suspense fallback={<div className={cn(htmlProseClass, className)} />}>
				<StaticHtmlContent content={content} className={className} />
			</Suspense>
		);
	}

	return (
		<div className={cn("break-words", className)}>
			<SmartMarkdown>{content}</SmartMarkdown>
		</div>
	);
}
