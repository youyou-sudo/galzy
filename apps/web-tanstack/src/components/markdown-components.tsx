import { cn } from "@web/lib/utils";
import type { ComponentProps } from "react";

// Typography components for react-markdown
export const MarkdownComponents = {
	h1: ({ className, ...props }: ComponentProps<"h1">) => (
		<h1
			className={cn(
				"text-2xl font-semibold tracking-tight scroll-m-20",
				className,
			)}
			{...props}
		/>
	),
	h2: ({ className, ...props }: ComponentProps<"h2">) => (
		<h2
			className={cn(
				"pb-2 text-xl font-semibold tracking-tight border-b border-border/70 scroll-m-20 first:mt-0",
				className,
			)}
			{...props}
		/>
	),
	h3: ({ className, ...props }: ComponentProps<"h3">) => (
		<h3
			className={cn(
				"text-lg font-semibold tracking-tight scroll-m-20",
				className,
			)}
			{...props}
		/>
	),
	h4: ({ className, ...props }: ComponentProps<"h4">) => (
		<h4
			className={cn(
				"text-base font-semibold tracking-tight scroll-m-20",
				className,
			)}
			{...props}
		/>
	),
	h5: ({ className, ...props }: ComponentProps<"h5">) => (
		<h5
			className={cn(
				"text-sm font-semibold tracking-tight scroll-m-20",
				className,
			)}
			{...props}
		/>
	),
	h6: ({ className, ...props }: ComponentProps<"h6">) => (
		<h6
			className={cn(
				"text-sm font-semibold tracking-tight scroll-m-20",
				className,
			)}
			{...props}
		/>
	),
	p: ({ className, ...props }: ComponentProps<"p">) => (
		<p className={cn("leading-7 not-first:mt-5", className)} {...props} />
	),
	ul: ({ className, ...props }: ComponentProps<"ul">) => (
		<ul
			className={cn("my-6 ml-6 list-disc [&>li]:mt-2", className)}
			{...props}
		/>
	),
	ol: ({ className, ...props }: ComponentProps<"ol">) => (
		<ol
			className={cn("my-6 ml-6 list-decimal [&>li]:mt-2", className)}
			{...props}
		/>
	),
	li: ({ className, ...props }: ComponentProps<"li">) => (
		<li className={cn("", className)} {...props} />
	),
	blockquote: ({ className, ...props }: ComponentProps<"blockquote">) => (
		<blockquote
			className={cn("pl-6 mt-6 italic text-muted-foreground border-l-2 border-border", className)}
			{...props}
		/>
	),
	img: ({ className, alt, ...props }: ComponentProps<"img">) => (
		<img
			className={cn("rounded-xl", className)}
			alt={alt}
			loading="lazy"
			decoding="async"
			{...props}
		/>
	),
	hr: ({ ...props }) => <hr className="my-4 md:my-8" {...props} />,
	table: ({ className, ...props }: ComponentProps<"table">) => (
		<div className="overflow-x-auto my-6 w-full">
			<table className={cn("w-full", className)} {...props} />
		</div>
	),
	tr: ({ className, ...props }: ComponentProps<"tr">) => (
		<tr
			className={cn("p-0 m-0 border-t even:bg-muted", className)}
			{...props}
		/>
	),
	th: ({ className, ...props }: ComponentProps<"th">) => (
		<th
			className={cn(
				"px-4 py-2 font-medium text-left border border-border/70 [[align=center]]:text-center [[align=right]]:text-right",
				className,
			)}
			{...props}
		/>
	),
	td: ({ className, ...props }: ComponentProps<"td">) => (
		<td
			className={cn(
				"px-4 py-2 text-left border [[align=center]]:text-center [[align=right]]:text-right",
				className,
			)}
			{...props}
		/>
	),
	pre: ({ className, ...props }: ComponentProps<"pre">) => (
		<pre
			className={cn(
				"overflow-x-auto p-4 mt-6 mb-4 bg-muted rounded-xl border border-border/70",
				className,
			)}
			{...props}
		/>
	),
	code: ({ className, ...props }: ComponentProps<"code">) => (
		<code
			className={cn(
				"relative px-[0.3rem] py-[0.2rem] font-mono text-sm font-medium bg-muted rounded-md",
				className,
			)}
			{...props}
		/>
	),
	a: ({ className, ...props }: ComponentProps<"a">) => (
		<a
			className={cn(
				"font-medium text-primary underline underline-offset-4 transition-colors hover:text-primary/80",
				className,
			)}
			{...props}
		/>
	),
	strong: ({ className, ...props }: ComponentProps<"strong">) => (
		<strong className={cn("font-semibold", className)} {...props} />
	),
	em: ({ className, ...props }: ComponentProps<"em">) => (
		<em className={cn("italic", className)} {...props} />
	),
};

/**
 * 文章正文（攻略 / 帖子）排版：标题缩放到页面标题（text-2xl）之下，
 * 并带上下留白，避免正文标题压过页面标题。
 */
export const ArticleMarkdownComponents = {
	...MarkdownComponents,
	h1: ({ className, ...props }: ComponentProps<"h1">) => (
		<h1
			className={cn(
				"mt-6 mb-2 text-xl font-semibold tracking-tight scroll-m-20 first:mt-0",
				className,
			)}
			{...props}
		/>
	),
	h2: ({ className, ...props }: ComponentProps<"h2">) => (
		<h2
			className={cn(
				"mt-6 mb-2 text-lg font-semibold tracking-tight scroll-m-20 first:mt-0",
				className,
			)}
			{...props}
		/>
	),
	h3: ({ className, ...props }: ComponentProps<"h3">) => (
		<h3
			className={cn(
				"mt-5 mb-1.5 text-base font-semibold tracking-tight scroll-m-20 first:mt-0",
				className,
			)}
			{...props}
		/>
	),
	h4: ({ className, ...props }: ComponentProps<"h4">) => (
		<h4
			className={cn(
				"mt-4 mb-1 text-sm font-semibold tracking-tight scroll-m-20 first:mt-0",
				className,
			)}
			{...props}
		/>
	),
	h5: ({ className, ...props }: ComponentProps<"h5">) => (
		<h5
			className={cn(
				"mt-4 mb-1 text-sm font-semibold scroll-m-20 first:mt-0",
				className,
			)}
			{...props}
		/>
	),
	h6: ({ className, ...props }: ComponentProps<"h6">) => (
		<h6
			className={cn(
				"mt-4 mb-1 text-sm font-semibold scroll-m-20 first:mt-0",
				className,
			)}
			{...props}
		/>
	),
};
