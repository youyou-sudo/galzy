/**
 * 富文本渲染：按 contentType 智能渲染帖子 / 文章正文。
 *
 * - markdown：走 SmartMarkdown（纯文本 / Markdown 智能检测）
 * - html：富文本编辑器输出，服务端已 rehype-sanitize，可直接 dangerouslySetInnerHTML
 */
import { SmartMarkdown } from "@web/components/SmartMarkdown";
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
				dangerouslySetInnerHTML={{ __html: content }}
			/>
		);
	}

	return (
		<div className={cn("break-words", className)}>
			<SmartMarkdown>{content}</SmartMarkdown>
		</div>
	);
}
