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
 *
 * fallback 用骨架而非空占位：tiptap chunk 未就绪（冷启动 / 弱网 / 正文很长）
 * 时给出与正文同宽的灰条加载态，正文区域不会先空白再突然出现。
 */

import { RichContentSkeleton } from "@web/components/rich-content-skeleton";
import { SmartMarkdown } from "@web/components/SmartMarkdown";
import { renderHtmlContent } from "@web/lib/rich-content-render";
import { cn } from "@web/lib/utils";
import { Suspense, use } from "react";

export type RichContentType = "markdown" | "html";

const htmlProseClass =
	"max-w-none break-words prose prose-sm dark:prose-invert sm:prose-base";

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
			<Suspense
				fallback={
					// 与正文保持同一层 prose 容器：加载完成时宽度/缩进不跳动
					<div className={cn(htmlProseClass, className)} aria-busy="true">
						<RichContentSkeleton />
					</div>
				}
			>
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
