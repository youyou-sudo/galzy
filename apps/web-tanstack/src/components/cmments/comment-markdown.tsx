import { cn } from "@web/lib/utils";
import { memo, type ComponentProps } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

const commentComponents = {
	h1: ({ className, ...props }: ComponentProps<"h1">) => (
		<h1
			className={cn("mt-2 mb-1 text-base font-semibold", className)}
			{...props}
		/>
	),
	h2: ({ className, ...props }: ComponentProps<"h2">) => (
		<h2
			className={cn("mt-2 mb-1 text-sm font-semibold", className)}
			{...props}
		/>
	),
	h3: ({ className, ...props }: ComponentProps<"h3">) => (
		<h3
			className={cn("mt-2 mb-1 text-sm font-semibold", className)}
			{...props}
		/>
	),
	h4: ({ className, ...props }: ComponentProps<"h4">) => (
		<h4
			className={cn("mt-1.5 mb-0.5 text-sm font-medium", className)}
			{...props}
		/>
	),
	h5: ({ className, ...props }: ComponentProps<"h5">) => (
		<h5
			className={cn("mt-1.5 mb-0.5 text-sm font-medium", className)}
			{...props}
		/>
	),
	h6: ({ className, ...props }: ComponentProps<"h6">) => (
		<h6
			className={cn("mt-1.5 mb-0.5 text-sm font-medium", className)}
			{...props}
		/>
	),
	p: ({ className, ...props }: ComponentProps<"p">) => (
		<p className={cn("my-0.5 first:mt-0 last:mb-0", className)} {...props} />
	),
	ul: ({ className, ...props }: ComponentProps<"ul">) => (
		<ul className={cn("pl-4 my-0.5 list-disc", className)} {...props} />
	),
	ol: ({ className, ...props }: ComponentProps<"ol">) => (
		<ol className={cn("pl-4 my-0.5 list-decimal", className)} {...props} />
	),
	li: ({ className, ...props }: ComponentProps<"li">) => (
		<li className={cn("my-0.5", className)} {...props} />
	),
	blockquote: ({ className, ...props }: ComponentProps<"blockquote">) => (
		<blockquote
			className={cn(
				"pl-3 my-1 text-muted-foreground border-l-2 border-border/60",
				className,
			)}
			{...props}
		/>
	),
	code: ({ className, ...props }: ComponentProps<"code">) => (
		<code
			className={cn(
				"px-1 py-0.5 font-mono text-xs bg-muted rounded",
				className,
			)}
			{...props}
		/>
	),
	pre: ({ className, ...props }: ComponentProps<"pre">) => (
		<pre
			className={cn(
				"overflow-x-auto p-2 my-1 font-mono text-xs bg-muted rounded",
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
			className={cn("my-1 max-w-full rounded", className)}
			alt={alt}
			loading="lazy"
			decoding="async"
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
				"px-2 py-1 font-medium text-left bg-muted border border-border",
				className,
			)}
			{...props}
		/>
	),
	td: ({ className, ...props }: ComponentProps<"td">) => (
		<td
			className={cn("px-2 py-1 border border-border", className)}
			{...props}
		/>
	),
};

export const CommentMarkdown = memo(function CommentMarkdown({
	content,
}: {
	content: string;
}) {
	return (
		<div className="text-sm break-words text-foreground/80">
			<Markdown
				remarkPlugins={[remarkGfm]}
				rehypePlugins={[rehypeRaw]}
				components={commentComponents}
			>
				{content}
			</Markdown>
		</div>
	);
});
