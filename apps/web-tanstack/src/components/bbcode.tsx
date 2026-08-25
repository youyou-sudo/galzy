import { cn } from "@web/lib/utils";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

type BBCodeRendererProps = {
	inline?: boolean;
	text: string;
};

type DescriptionPreview = {
	text: string;
	isTruncated: boolean;
};

const toDescriptionHref = (value: string): string | null => {
	const url = value.trim();
	const internalMatch = url.match(/^\/?([vgp]\d+)$/i);

	if (internalMatch) {
		const id = internalMatch[1];
		const prefix = id[0].toLowerCase();

		if (prefix === "g") return `/tags/${id}`;
		if (prefix === "p") return `/producer/${id}`;
		return `/${id}`;
	}

	return /^https?:\/\//i.test(url) ? url : null;
};

/**
 * Kungal 简介有时会带有 Markdown，同时 VNDB 简介仍然使用 BBCode。
 * 先清理数据源的换行标记并将已支持的 BBCode 转成 Markdown，统一交给
 * react-markdown 渲染，避免通过 dangerouslySetInnerHTML 注入 HTML。
 */
export function normalizeDescription(text: string): string {
	return (
		text
			.replace(/\r\n?/g, "\n")
			.replace(/\\n/g, "\n")
			// 数据源用行尾或独立一行的反斜杠表示换行。
			.replace(/[\\]+[ \t]*(?=\n|$)/g, "")
			// 修正 Kungal 当前 Wikipedia 署名中的非标准 Markdown 分隔符。
			.replace(
				/\*\\?\[(?:From|Form)\*\s+\*\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)\*\s+\*, used under CC BY-SA 4\.0 licenses\]\*/gi,
				"*From [$1]($2), used under CC BY-SA 4.0 licenses*",
			)
	);
}

export function getDescriptionPreview(text: string): DescriptionPreview {
	const lines = normalizeDescription(text)
		.split("\n")
		.filter((line) => line.trim() !== "");
	const isTruncated = lines.length > 6;

	return {
		text: `${lines.slice(0, 6).join("\n")}${isTruncated ? "..." : ""}`,
		isTruncated,
	};
}

function bbcodeToMarkdown(text: string): string {
	let markdown = normalizeDescription(text);

	markdown = markdown.replace(
		/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi,
		(_match, url: string, label: string) => {
			const href = toDescriptionHref(url);
			return href ? `[${label}](${href})` : label;
		},
	);
	markdown = markdown.replace(
		/\[url\]([\s\S]*?)\[\/url\]/gi,
		(_match, label: string) => {
			const href = toDescriptionHref(label);
			return href ? `[${label}](${href})` : label;
		},
	);
	markdown = markdown.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, "**$1**");
	markdown = markdown.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, "*$1*");
	markdown = markdown.replace(
		/\[quote\]([\s\S]*?)\[\/quote\]/gi,
		(_match, content: string) =>
			content
				.split("\n")
				.map((line) => `> ${line}`)
				.join("\n"),
	);
	markdown = markdown.replace(/\[From ErogeShop\]/gi, "*[From ErogeShop]*");

	return markdown;
}

export const BBCodeRenderer = ({
	inline = false,
	text,
}: BBCodeRendererProps) => {
	const Root = inline ? "span" : "div";

	return (
		<Root className="wrap-break-word [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
			<Markdown
				remarkPlugins={[remarkGfm, remarkBreaks]}
				components={{
					...(inline
						? {
								p: ({ children }) => <span>{children}</span>,
							}
						: {}),
					a: ({ className, href, node: _node, ...props }) => (
						<a
							className={cn(
								"text-primary underline-offset-4 hover:underline",
								className,
							)}
							href={href}
							{...props}
							{...(href?.match(/^https?:\/\//i)
								? { target: "_blank", rel: "noopener noreferrer" }
								: {})}
						/>
					),
				}}
			>
				{bbcodeToMarkdown(text)}
			</Markdown>
		</Root>
	);
};
