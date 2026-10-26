import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@web/lib/utils";

const alertVariants = cva(
	"group/alert grid relative gap-0.5 px-2.5 py-2 w-full text-sm text-left rounded-lg border *:[svg:not([class*='size-'])]:size-4 *:[svg]:row-span-2 *:[svg]:text-current *:[svg]:translate-y-0.5 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18",
	{
		variants: {
			variant: {
				default: "text-card-foreground bg-card",
				destructive:
					"text-destructive bg-card *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function Alert({
	className,
	variant,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
	return (
		<div
			data-slot="alert"
			role="alert"
			className={cn(alertVariants({ variant }), className)}
			{...props}
		/>
	);
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-title"
			className={cn(
				"font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
				className,
			)}
			{...props}
		/>
	);
}

function AlertDescription({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-description"
			className={cn(
				"text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4 [&_a]:hover:text-foreground",
				className,
			)}
			{...props}
		/>
	);
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-action"
			className={cn("absolute top-2 right-2", className)}
			{...props}
		/>
	);
}

export { Alert, AlertTitle, AlertDescription, AlertAction };
