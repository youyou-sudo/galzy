import * as React from "react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@web/lib/utils";
import { Separator } from "@web/components/ui/separator";

function ItemGroup({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			role="list"
			data-slot="item-group"
			className={cn(
				"group/item-group flex flex-col gap-4 w-full has-data-[size=sm]:gap-2.5 has-data-[size=xs]:gap-2",
				className,
			)}
			{...props}
		/>
	);
}

function ItemSeparator({
	className,
	...props
}: React.ComponentProps<typeof Separator>) {
	return (
		<Separator
			data-slot="item-separator"
			orientation="horizontal"
			className={cn("my-2", className)}
			{...props}
		/>
	);
}

const itemVariants = cva(
	"group/item flex flex-wrap items-center w-full text-sm rounded-lg border outline-none transition-colors duration-100 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 [a]:transition-colors [a]:hover:bg-muted",
	{
		variants: {
			variant: {
				default: "border-transparent",
				outline: "border-border",
				muted: "bg-muted/50 border-transparent",
			},
			size: {
				default: "gap-2.5 px-3 py-2.5",
				sm: "gap-2.5 px-3 py-2.5",
				xs: "gap-2 px-2.5 py-2 in-data-[slot=dropdown-menu-content]:p-0",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Item({
	className,
	variant = "default",
	size = "default",
	render,
	...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof itemVariants>) {
	return useRender({
		defaultTagName: "div",
		props: mergeProps<"div">(
			{
				className: cn(itemVariants({ variant, size, className })),
			},
			props,
		),
		render,
		state: {
			slot: "item",
			variant,
			size,
		},
	});
}

const itemMediaVariants = cva(
	"flex shrink-0 gap-2 justify-center items-center group-has-data-[slot=item-description]/item:self-start group-has-data-[slot=item-description]/item:translate-y-0.5 [&_svg]:pointer-events-none",
	{
		variants: {
			variant: {
				default: "bg-transparent",
				icon: "[&_svg:not([class*='size-'])]:size-4",
				image:
					"overflow-hidden size-10 rounded-sm group-data-[size=sm]/item:size-8 group-data-[size=xs]/item:size-6 [&_img]:object-cover [&_img]:size-full",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function ItemMedia({
	className,
	variant = "default",
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof itemMediaVariants>) {
	return (
		<div
			data-slot="item-media"
			data-variant={variant}
			className={cn(itemMediaVariants({ variant, className }))}
			{...props}
		/>
	);
}

function ItemContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="item-content"
			className={cn(
				"flex flex-col flex-1 gap-1 group-data-[size=xs]/item:gap-0 [&+[data-slot=item-content]]:flex-none",
				className,
			)}
			{...props}
		/>
	);
}

function ItemTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="item-title"
			className={cn(
				"line-clamp-1 flex gap-2 items-center w-fit text-sm leading-snug font-medium underline-offset-4",
				className,
			)}
			{...props}
		/>
	);
}

function ItemDescription({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p
			data-slot="item-description"
			className={cn(
				"text-sm leading-normal font-normal line-clamp-2 text-left text-muted-foreground group-data-[size=xs]/item:text-xs [&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
				className,
			)}
			{...props}
		/>
	);
}

function ItemActions({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="item-actions"
			className={cn("flex gap-2 items-center", className)}
			{...props}
		/>
	);
}

function ItemHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="item-header"
			className={cn(
				"flex basis-full gap-2 justify-between items-center",
				className,
			)}
			{...props}
		/>
	);
}

function ItemFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="item-footer"
			className={cn(
				"flex basis-full gap-2 justify-between items-center",
				className,
			)}
			{...props}
		/>
	);
}

export {
	Item,
	ItemMedia,
	ItemContent,
	ItemActions,
	ItemGroup,
	ItemSeparator,
	ItemTitle,
	ItemDescription,
	ItemHeader,
	ItemFooter,
};
