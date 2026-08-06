import { cn } from "@web/lib/utils";
import type { ComponentProps } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

const commentComponents = {
	h1: ({ className, ...props }: ComponentProps<"h1">) => (
		<h1
			className={cn("text-base font-semibold mt-2 mb-1", className)}
			{...props}
		/>
	),
	h2: ({ className, ...props }: ComponentProps<"h2">) => (
		<h2
			className={cn("text-sm font-semibold mt-2 mb-1", className)}
			{...props}
		/>
	),
	h3: ({ className, ...props }: ComponentProps<"h3">) => (
		<h3
			className={cn("text-sm font-semibold mt-2 mb-1", className)}
			{...props}
		/>
	),
	h4: ({ className, ...props }: ComponentProps<"h4">) => (
		<h4
			className={cn("text-sm font-medium mt-1.5 mb-0.5", className)}
			{...props}
		/>
	),
	h5: ({ className, ...props }: ComponentProps<"h5">) => (
		<h5
			className={cn("text-sm font-medium mt-1.5 mb-0.5", className)}
			{...props}
		/>
	),
	h6: ({ className, ...props }: ComponentProps<"h6">) => (
		<h6
			className={cn("text-sm font-medium mt-1.5 mb-0.5", className)}
			{...props}
		/>
	),
	p: ({ className, ...props }: ComponentProps<"p">) => (
		<p className={cn("my-1", className)} {...props} />
	),
	ul: ({ className, ...props }: ComponentProps<"ul">) => (
		<ul className={cn("list-disc pl-4 my-1", className)} {...props} />
	),
	ol: ({ className, ...props }: ComponentProps<"ol">) => (
		<ol className={cn("list-decimal pl-4 my-1", className)} {...props} />
	),
	li: ({ className, ...props }: ComponentProps<"li">) => (
		<li className={cn("my-0.5", className)} {...props} />
	),
	blockquote: ({ className, ...props }: ComponentProps<"blockquote">) => (
		<blockquote
			className={cn(
				"border-l-2 border-muted-foreground/30 pl-3 my-2 text-muted-foreground",
				className,
			)}
			{...props}
		/>
	),
	code: ({ className, ...props }: ComponentProps<"code">) => (
		<code
			className={cn(
				"bg-muted px-1 py-0.5 rounded text-xs font-mono",
				className,
			)}
			{...props}
		/>
	),
	pre: ({ className, ...props }: ComponentProps<"pre">) => (
		<pre
			className={cn(
				"bg-muted p-2 rounded text-xs font-mono overflow-x-auto my-1",
				className,
			)}
			{...props}
		/>
	),
	a: ({ className, ...props }: ComponentProps<"a">) => (
		<a
			className={cn("text-primary underline underline-offset-2", className)}
			target="_blank"
			rel="noopener noreferrer"
			{...props}
		/>
	),
	strong: ({ className, ...props }: ComponentProps<"strong">) => (
		<strong className={cn("font-semibold", className)} {...props} />
	),
	em: ({ className, ...props }: ComponentProps<"em">) => (
		<em className={cn("italic", className)} {...props} />
	),
	del: ({ className, ...props }: ComponentProps<"del">) => (
		<del className={cn("line-through", className)} {...props} />
	),
	img: ({ className, alt, ...props }: ComponentProps<"img">) => (
		<img
			className={cn("rounded max-w-full my-1", className)}
			alt={alt}
			{...props}
		/>
	),
	hr: ({ ...props }) => <hr className="my-2 border-border" {...props} />,
	table: ({ className, ...props }: ComponentProps<"table">) => (
		<div className="overflow-x-auto my-1">
			<table className={cn("text-xs border-collapse", className)} {...props} />
		</div>
	),
	th: ({ className, ...props }: ComponentProps<"th">) => (
		<th
			className={cn(
				"border border-border px-2 py-1 bg-muted font-medium text-left",
				className,
			)}
			{...props}
		/>
	),
	td: ({ className, ...props }: ComponentProps<"td">) => (
		<td
			className={cn("border border-border px-2 py-1", className)}
			{...props}
		/>
	),
};

export function CommentMarkdown({ content }: { content: string }) {
	return (
		<div className="text-sm text-foreground/80 break-words">
			<Markdown
				remarkPlugins={[remarkGfm]}
				rehypePlugins={[rehypeRaw]}
				components={commentComponents}
			>
				{content}
			</Markdown>
		</div>
	);
}
