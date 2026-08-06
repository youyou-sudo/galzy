import {
	isMarkdownContent,
	normalizeTxtForMarkdown,
} from "@web/lib/markdown-content";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { ArticleMarkdownComponents } from "./markdown-components";

/**
 * 攻略内容智能渲染：纯 txt 与 markdown 之间的平衡。
 *
 * - 纯文本（无 markdown 特征）→ pre-wrap 原样输出，空行 / 缩进 / 对齐 100% 还原
 * - 含 markdown → 正常渲染 + remark-breaks（单换行保留）+ txt 兼容预处理
 */
export function SmartMarkdown({ children }: { children?: string | null }) {
	const content = children ?? "";
	if (!isMarkdownContent(content)) {
		return <div className="whitespace-pre-wrap break-words">{content}</div>;
	}
	return (
		<Markdown
			remarkPlugins={[remarkGfm, remarkBreaks]}
			rehypePlugins={[rehypeRaw]}
			components={ArticleMarkdownComponents}
		>
			{normalizeTxtForMarkdown(content)}
		</Markdown>
	);
}
