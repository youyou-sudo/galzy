/**
 * 富文本渲染：按 contentType 智能渲染帖子 / 文章正文。
 *
 * - markdown：走 SmartMarkdown（纯文本 / Markdown 智能检测）
 * - html：先用编辑器同一套扩展（@tiptap/html generateJSON）把已净化 HTML
 *   解析为文档，再用 @tiptap/static-renderer（renderToHTMLString）按扩展的
 *   renderHTML 输出 —— 与编辑器内所见完全一致（图片对齐、代码块、引用等）。
 */

import { SmartMarkdown } from "@web/components/SmartMarkdown";
import { renderHtmlContent } from "@web/lib/rich-content-render";
import { cn } from "@web/lib/utils";

export type RichContentType = "markdown" | "html";

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
			<div
				className={cn(
					"prose prose-sm sm:prose-base dark:prose-invert max-w-none break-words",
					className,
				)}
				dangerouslySetInnerHTML={{ __html: renderHtmlContent(content) }}
			/>
		);
	}

	return (
		<div className={cn("break-words", className)}>
			<SmartMarkdown>{content}</SmartMarkdown>
		</div>
	);
}
