import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@web/lib/utils";

const badgeVariants = cva(
	"group/badge inline-flex overflow-hidden shrink-0 gap-1 justify-center items-center px-2 py-0.5 w-fit h-5 text-xs font-medium whitespace-nowrap rounded-4xl border border-transparent transition-[color,background-color,border-color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:size-3! [&>svg]:pointer-events-none",
	{
		variants: {
			variant: {
				default: "text-primary-foreground bg-primary [a]:hover:bg-primary/80",
				secondary:
					"text-secondary-foreground bg-secondary [a]:hover:bg-secondary/80",
				destructive:
					"text-destructive bg-destructive/10 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
				outline:
					"text-foreground border-border [a]:hover:text-muted-foreground [a]:hover:bg-muted",
				ghost:
					"hover:text-muted-foreground hover:bg-muted dark:hover:bg-muted/50",
				link: "text-primary underline-offset-4 hover:underline",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function Badge({
	className,
	variant = "default",
	render,
	...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
	return useRender({
		defaultTagName: "span",
		props: mergeProps<"span">(
			{
				className: cn(badgeVariants({ variant }), className),
			},
			props,
		),
		render,
		state: {
			slot: "badge",
			variant,
		},
	});
}

export { Badge, badgeVariants };
