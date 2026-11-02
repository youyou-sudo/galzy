import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@web/lib/utils";

const buttonVariants = cva(
	"group/button inline-flex shrink-0 justify-center items-center text-sm font-medium whitespace-nowrap bg-clip-padding rounded-lg border border-transparent outline-none transition-[color,background-color,border-color,box-shadow,transform] duration-200 select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:opacity-50 disabled:pointer-events-none aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:pointer-events-none",
	{
		variants: {
			variant: {
				default: "text-primary-foreground bg-primary hover:bg-primary/80",
				outline:
					"bg-background border-border hover:text-foreground hover:bg-muted aria-expanded:text-foreground aria-expanded:bg-muted dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
				secondary:
					"text-secondary-foreground bg-secondary hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:text-secondary-foreground aria-expanded:bg-secondary",
				ghost:
					"hover:text-foreground hover:bg-muted aria-expanded:text-foreground aria-expanded:bg-muted dark:hover:bg-muted/50",
				destructive:
					"text-destructive bg-destructive/10 hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
				link: "text-primary underline-offset-4 hover:underline",
			},
			size: {
				default:
					"gap-1.5 px-3 h-9 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
				xs: "gap-1 px-2 h-6 text-xs rounded-[min(var(--radius-md),10px)] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
				sm: "gap-1 px-2.5 h-8 text-[0.8rem] rounded-[min(var(--radius-md),12px)] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
				lg: "gap-1.5 px-3 h-10 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
				icon: "size-9",
				"icon-xs":
					"size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
				"icon-sm":
					"size-8 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
				"icon-lg": "size-10",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Button({
	className,
	variant = "default",
	size = "default",
	...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
	return (
		<ButtonPrimitive
			data-slot="button"
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
