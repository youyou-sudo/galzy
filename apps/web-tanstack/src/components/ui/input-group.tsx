import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@web/lib/utils";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Textarea } from "@web/components/ui/textarea";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="input-group"
			role="group"
			className={cn(
				"group/input-group flex relative items-center w-full min-w-0 h-9 bg-background/60 rounded-xl border border-input outline-none transition-colors duration-200 has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:h-auto has-[>textarea]:h-auto has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-2 has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-disabled:bg-input/50 has-disabled:opacity-50 has-[>[data-align=block-end]]:[&>input]:pt-3 has-[>[data-align=block-start]]:[&>input]:pb-3 has-[>[data-align=inline-end]]:[&>input]:pr-1.5 has-[>[data-align=inline-start]]:[&>input]:pl-1.5 in-data-[slot=combobox-content]:focus-within:border-inherit in-data-[slot=combobox-content]:focus-within:ring-0 dark:bg-input/30 dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40 dark:has-disabled:bg-input/80",
				className,
			)}
			{...props}
		/>
	);
}

const inputGroupAddonVariants = cva(
	"flex gap-2 justify-center items-center py-1.5 h-auto text-sm font-medium text-muted-foreground cursor-text select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4",
	{
		variants: {
			align: {
				"inline-start":
					"order-first pl-2 has-[>button]:ml-[-0.3rem] has-[>kbd]:ml-[-0.15rem]",
				"inline-end":
					"order-last pr-2 has-[>button]:mr-[-0.3rem] has-[>kbd]:mr-[-0.15rem]",
				"block-start":
					"order-first justify-start px-2.5 pt-2 w-full group-has-[>input]/input-group:pt-2 [.border-b]:pb-2",
				"block-end":
					"order-last justify-start px-2.5 pb-2 w-full group-has-[>input]/input-group:pb-2 [.border-t]:pt-2",
			},
		},
		defaultVariants: {
			align: "inline-start",
		},
	},
);

function InputGroupAddon({
	className,
	align = "inline-start",
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
	return (
		<div
			role="group"
			data-slot="input-group-addon"
			data-align={align}
			className={cn(inputGroupAddonVariants({ align }), className)}
			onClick={(e) => {
				if ((e.target as HTMLElement).closest("button")) {
					return;
				}
				e.currentTarget.parentElement?.querySelector("input")?.focus();
			}}
			{...props}
		/>
	);
}

const inputGroupButtonVariants = cva(
	"flex gap-2 items-center text-sm shadow-none",
	{
		variants: {
			size: {
				xs: "gap-1 px-1.5 h-6 rounded-[calc(var(--radius)-3px)] [&>svg:not([class*='size-'])]:size-3.5",
				sm: "",
				"icon-xs":
					"p-0 size-6 rounded-[calc(var(--radius)-3px)] has-[>svg]:p-0",
				"icon-sm": "p-0 size-8 has-[>svg]:p-0",
			},
		},
		defaultVariants: {
			size: "xs",
		},
	},
);

function InputGroupButton({
	className,
	type = "button",
	variant = "ghost",
	size = "xs",
	...props
}: Omit<React.ComponentProps<typeof Button>, "size"> &
	VariantProps<typeof inputGroupButtonVariants>) {
	return (
		<Button
			type={type}
			data-size={size}
			variant={variant}
			className={cn(inputGroupButtonVariants({ size }), className)}
			{...props}
		/>
	);
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			className={cn(
				"flex gap-2 items-center text-sm text-muted-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
				className,
			)}
			{...props}
		/>
	);
}

function InputGroupInput({
	className,
	...props
}: React.ComponentProps<"input">) {
	return (
		<Input
			data-slot="input-group-control"
			className={cn(
				"flex-1 bg-transparent rounded-none border-0 ring-0 shadow-none focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent",
				className,
			)}
			{...props}
		/>
	);
}

function InputGroupTextarea({
	className,
	...props
}: React.ComponentProps<"textarea">) {
	return (
		<Textarea
			data-slot="input-group-control"
			className={cn(
				"flex-1 py-2 bg-transparent rounded-none border-0 ring-0 shadow-none resize-none focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent",
				className,
			)}
			{...props}
		/>
	);
}

export {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupText,
	InputGroupInput,
	InputGroupTextarea,
};
